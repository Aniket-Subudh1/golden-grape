import { createHash } from 'node:crypto';
import type { Payload, PayloadRequest } from 'payload';
import { AppError } from '@/lib/errors';
import { getDictionary, type Locale } from '@/lib/i18n';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { addDays, fromLocal, today } from '@/lib/time';
import { model, type Tx, withTx } from '@/lib/tx';
import { NUMBERING } from '@/modules/settings/globals';
import type { DocumentFile, Quotation } from '@/payload-types';
import { type PdfBusiness, type PdfSignature, renderQuotationPdf } from './pdf/quotation';

// Catering quotations (Q-12): from a catering request to a signed PDF. Every state change is one claim on the status
// (`updateOne` with the expected status), so two clicks, two staff or two browser tabs change it once. Numbers are
// given when a quotation is sent, in the same transaction as its PDF: a failed send does not use a number.

export type QuotationRender = typeof renderQuotationPdf;
type Id = string;

const idOf = (value: unknown) => (value && typeof value === 'object' ? String((value as { id: string }).id) : value ? String(value) : null);

/** "DEV-2026-0001 · Roby Test", or "Brouillon · Roby Test" before it is sent: the title staff see everywhere. */
export const quotationTitle = (number: string | null | undefined, name: string | null | undefined) => `${number ?? 'Brouillon'} · ${name ?? ''}`.trim();

/** A sent quotation past its last valid day (Luxembourg calendar) can no longer be accepted. */
export function isExpired(q: Pick<Quotation, 'status' | 'validUntil'>, now = new Date()) {
  if (q.status !== 'sent' && q.status !== 'viewed') return false;
  return Boolean(q.validUntil) && today(new Date(q.validUntil)) < today(now);
}

/** A day picked in the admin, kept at noon in Luxembourg so it never shifts to the day before. */
const noonOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return fromLocal(y, m, d, 12).toISOString();
};

async function business(payload: Payload, req?: PayloadRequest): Promise<PdfBusiness & { numbering?: { quotation?: string | null } | null }> {
  const settings = await payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true, req });
  return { ...settings.business, numbering: settings.numbering };
}

/** The PDF of a quotation in its language (the signed copy when `signature` is given). */
export async function quotationPdf(payload: Payload, q: Quotation, { signature, render = renderQuotationPdf, req }: { signature?: PdfSignature | null; render?: QuotationRender; req?: PayloadRequest } = {}) {
  const locale = (q.locale ?? 'fr') as Locale;
  const [{ documents }, b] = await Promise.all([getDictionary(locale), business(payload, req)]);
  return render({ q, t: documents, locale, business: b, signature });
}

async function storeFile(tx: Tx, file: { kind: 'quotation' | 'quotation_signed'; filename: string; buffer: Buffer; quotation: Id; customer?: Id | null }) {
  return tx.req.payload.create({
    collection: 'documentFiles',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: {
      kind: file.kind,
      filename: file.filename,
      quotation: file.quotation,
      customer: file.customer ?? undefined,
      sizeBytes: file.buffer.length,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      data: file.buffer.toString('base64'),
    },
  });
}

/** A stored PDF with its bytes (server only: the API never returns `data`). */
export async function readDocument(payload: Payload, id: string) {
  const doc = (await payload.findByID({ collection: 'documentFiles', id, depth: 0, overrideAccess: true, disableErrors: true })) as (DocumentFile & { data?: string }) | null;
  if (!doc?.data) return null;
  return { doc, buffer: Buffer.from(doc.data, 'base64') };
}

const customerByEmail = async (payload: Payload, email: string | null | undefined, req?: PayloadRequest) =>
  email ? ((await payload.find({ collection: 'customers', where: { email: { equals: email.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]?.id ?? null) : null;

/** The catering request's status, set only by its quotations ("Devis envoyé", accepted, declined). */
async function setRequestStatus(tx: Tx, requestId: string | null, status: 'quoted' | 'accepted' | 'declined') {
  if (!requestId) return null;
  const before = await tx.req.payload.findByID({ collection: 'cateringRequests', id: requestId, depth: 0, overrideAccess: true, req: tx.req, disableErrors: true });
  if (!before || before.status === status) return null;
  await tx.req.payload.update({ collection: 'cateringRequests', id: requestId, data: { status }, overrideAccess: true, depth: 0, req: tx.req, context: { byQuotation: true } });
  return { id: requestId, number: before.number, from: before.status, to: status };
}
export type RequestMove = Awaited<ReturnType<typeof setRequestStatus>>;

/**
 * "Créer un devis" on a catering request: a draft with the customer, the date, place and guests, the customer's
 * message, the chosen menu × guests at its price per guest, and the default conditions and validity (Shop details).
 */
export async function createQuotationFromRequest(payload: Payload, requestId: string, now = new Date()) {
  const request = await payload.findByID({ collection: 'cateringRequests', id: requestId, depth: 0, overrideAccess: true, disableErrors: true });
  if (!request) throw new AppError('NOT_FOUND', 'request');
  const locale = (request.locale ?? 'fr') as Locale;
  const [pkg, settings, customer] = await Promise.all([
    payload.findByID({ collection: 'cateringPackages', id: String(idOf(request.package)), locale, depth: 0, overrideAccess: true, disableErrors: true }),
    payload.findGlobal({ slug: 'BusinessSettings', locale, depth: 0, overrideAccess: true }),
    customerByEmail(payload, request.contact?.email),
  ]);
  return payload.create({
    collection: 'quotations',
    overrideAccess: true,
    depth: 0,
    data: {
      title: quotationTitle(null, request.contact?.name),
      status: 'draft',
      cateringRequest: request.id,
      customer,
      contact: { name: request.contact?.name ?? '', email: request.contact?.email ?? '', phone: request.contact?.phone },
      event: { date: request.date, time: request.time, guests: request.guests, location: request.location },
      customerMessage: request.notes,
      locale,
      // A catering menu is a meal served at the event: super-reduced VAT until the accountant says otherwise (A-15).
      lines: pkg
        ? [{ description: pkg.name, detail: (pkg.includes ?? []).map((i) => i.item).join(', ') || undefined, qty: request.guests, unitPriceCents: pkg.pricePerGuestCents, vat: 'superReduced' }]
        : [],
      discount: { kind: 'none' },
      conditions: settings.quotationConditions ?? undefined,
      validUntil: noonOf(addDays(today(now), settings.quotationValidityDays ?? 30)),
    },
  });
}

/**
 * "Envoyer au client": the next DEV number, the PDF, its file, the status `sent`, the request "Devis envoyé", and the
 * request's other open quotations replaced (expired) — in one transaction. The e-mail goes after commit (actions.ts).
 */
export async function sendQuotation(payload: Payload, id: string, { now = new Date(), render }: { now?: Date; render?: QuotationRender } = {}) {
  return withTx(payload, async (tx) => {
    const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, req: tx.req, disableErrors: true });
    if (!q) throw new AppError('NOT_FOUND', 'quotation');
    if (q.status !== 'draft') throw new AppError('CONFLICT', 'notDraft');
    if (!q.contact?.email) throw new AppError('VALIDATION', 'email', 'contact');
    if (!q.lines?.length || !(q.totals?.totalCents && q.totals.totalCents > 0)) throw new AppError('VALIDATION', 'emptyQuotation', 'lines');
    const claim = await tx.model('quotations').updateOne({ _id: id, status: 'draft' }, { $set: { status: 'sent' } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'notDraft');

    const year = Number(today(now).slice(0, 4));
    const n = await nextNumber(tx, 'quotation', year);
    const { numbering } = await business(payload, tx.req);
    const number = formatNumber(numbering?.quotation ?? NUMBERING.quotation, year, n);
    const sentAt = now.toISOString();
    const buffer = await quotationPdf(payload, { ...q, number, sentAt, status: 'sent' }, { render, req: tx.req });
    const file = await storeFile(tx, { kind: 'quotation', filename: `${number}.pdf`, buffer, quotation: id, customer: idOf(q.customer) });
    const sent = await payload.update({
      collection: 'quotations',
      id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: { number, title: quotationTitle(number, q.contact?.name), status: 'sent', sentAt, pdf: file.id },
    });

    const requestId = idOf(q.cateringRequest);
    const replaced: { id: string; number: string | null }[] = [];
    if (requestId) {
      const { docs } = await payload.find({
        collection: 'quotations',
        where: { and: [{ cateringRequest: { equals: requestId } }, { id: { not_equals: id } }, { status: { in: ['sent', 'viewed'] } }] },
        depth: 0,
        limit: 0,
        overrideAccess: true,
        req: tx.req,
      });
      for (const old of docs) {
        const done = await tx.model('quotations').updateOne({ _id: old.id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'expired', expiredAt: now } }, { session: tx.session });
        if (done.matchedCount) replaced.push({ id: old.id, number: old.number ?? null });
      }
    }
    const request = await setRequestStatus(tx, requestId, 'quoted');
    return { quotation: sent, pdf: buffer, replaced, request };
  });
}

/** The customer opened the link: `sent` → `viewed` once, with the time. */
export async function markViewed(payload: Payload, id: string, now = new Date()) {
  const result = await model(payload, 'quotations').updateOne({ _id: id, status: 'sent' }, { $set: { status: 'viewed', viewedAt: now } });
  return result.modifiedCount > 0;
}

export type Signature = { name: string; ip: string; userAgent: string };

/**
 * The customer signs: still `sent` or `viewed` and not past its validity. In one transaction: `accepted` with the
 * signature (typed name, time, IP, browser), the signed PDF (with the fingerprint of the PDF that was sent) stored in
 * the customer's file, the customer account linked by e-mail, and the request accepted. Signed once, whatever happens.
 */
export async function acceptQuotation(payload: Payload, id: string, signature: Signature, { now = new Date(), render }: { now?: Date; render?: QuotationRender } = {}) {
  return withTx(payload, async (tx) => {
    const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, req: tx.req, disableErrors: true });
    if (!q) throw new AppError('NOT_FOUND', 'quotation');
    if (isExpired(q, now)) throw new AppError('CONFLICT', 'notAcceptable');
    const claim = await tx.model('quotations').updateOne({ _id: id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'accepted' } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'notAcceptable');

    const at = now.toISOString();
    const sentFile = q.pdf ? await payload.findByID({ collection: 'documentFiles', id: String(idOf(q.pdf)), depth: 0, overrideAccess: true, req: tx.req, disableErrors: true }) : null;
    const customer = idOf(q.customer) ?? (await customerByEmail(payload, q.contact?.email, tx.req));
    const signed = { ...q, status: 'accepted' as const, acceptedAt: at, signature: { name: signature.name, at, ip: signature.ip, userAgent: signature.userAgent } };
    const buffer = await quotationPdf(payload, signed, { signature: { name: signature.name, at, ip: signature.ip, sentSha256: sentFile?.sha256 }, render, req: tx.req });
    const file = await storeFile(tx, { kind: 'quotation_signed', filename: `${q.number ?? id}-signe.pdf`, buffer, quotation: id, customer });
    const accepted = await payload.update({
      collection: 'quotations',
      id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: { status: 'accepted', acceptedAt: at, signature: signed.signature, signedPdf: file.id, customer },
    });
    if (customer && q.pdf) await payload.update({ collection: 'documentFiles', id: String(idOf(q.pdf)), data: { customer }, overrideAccess: true, depth: 0, req: tx.req });
    const request = await setRequestStatus(tx, idOf(q.cateringRequest), 'accepted');
    return { quotation: accepted, pdf: buffer, request };
  });
}

/** The customer (on the page) or staff (a refusal by phone) decline: `declined`, with the reason; the request too. */
export async function declineQuotation(payload: Payload, id: string, { reason, now = new Date() }: { reason?: string; now?: Date } = {}) {
  return withTx(payload, async (tx) => {
    const claim = await tx.model('quotations').updateOne(
      { _id: id, status: { $in: ['sent', 'viewed'] } },
      { $set: { status: 'declined', declinedAt: now, declineReason: reason ?? null } },
      { session: tx.session },
    );
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'notAcceptable');
    const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, req: tx.req });
    const request = await setRequestStatus(tx, idOf(q.cateringRequest), 'declined');
    return { quotation: q, request };
  });
}

/** Daily (cron) and on demand: sent quotations past their last valid day become `expired`. Returns those changed. */
export async function expireQuotations(payload: Payload, now = new Date()) {
  const [y, m, d] = today(now).split('-').map(Number);
  const startOfToday = fromLocal(y, m, d, 0);
  const { docs } = await payload.find({
    collection: 'quotations',
    where: { and: [{ status: { in: ['sent', 'viewed'] } }, { validUntil: { less_than: startOfToday.toISOString() } }] },
    depth: 0,
    limit: 0,
    overrideAccess: true,
  });
  const expired: Quotation[] = [];
  for (const q of docs) {
    if (!isExpired(q, now)) continue;
    const done = await model(payload, 'quotations').updateOne({ _id: q.id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'expired', expiredAt: now } });
    if (done.modifiedCount) expired.push(q);
  }
  return expired;
}

/** "Nouvelle version": a draft copy of a sent quotation (same customer, event, lines and conditions), valid from today. */
export async function copyQuotation(payload: Payload, id: string, now = new Date()) {
  const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!q) throw new AppError('NOT_FOUND', 'quotation');
  const settings = await payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true });
  return payload.create({
    collection: 'quotations',
    overrideAccess: true,
    depth: 0,
    data: {
      title: quotationTitle(null, q.contact?.name),
      status: 'draft',
      cateringRequest: idOf(q.cateringRequest),
      customer: idOf(q.customer),
      contact: q.contact,
      event: q.event,
      customerMessage: q.customerMessage,
      locale: q.locale,
      lines: (q.lines ?? []).map(({ description, detail, qty, unitPriceCents, vat }) => ({ description, detail, qty, unitPriceCents, vat })),
      discount: q.discount,
      conditions: q.conditions,
      validUntil: noonOf(addDays(today(now), settings.quotationValidityDays ?? 30)),
    },
  });
}

/** A customer's own quotations (sent or later), newest first: read with their rights, never another customer's. */
export async function quotationsOf(payload: Payload, customer: { id: string; collection?: 'customers' }) {
  const { docs } = await payload.find({
    collection: 'quotations',
    where: { status: { not_equals: 'draft' } },
    sort: '-sentAt',
    limit: 100,
    depth: 0,
    overrideAccess: false,
    user: { ...customer, collection: 'customers' },
  });
  return docs;
}
