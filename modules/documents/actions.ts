'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import type { Payload } from 'payload';
import { z } from 'zod';
import { action, clientIp, publicAction } from '@/lib/action';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { checkLinkToken } from '@/lib/link-token';
import { rateLimit } from '@/lib/rate-limit';
import { ORDER_ROLES } from '@/modules/sales/order-states';
import { createB2bQuotation, orderFromQuotation } from './b2b';
import { toCsv } from '@/lib/table';
import { exportDocuments, issueCreditNote, issueDeliveryNote, issueInvoice, markInvoicePaid } from './invoicing';
import { mailBusinessDocument, mailQuotationDeclined, mailQuotationSent, mailQuotationSigned } from './mail';
import { acceptQuotation, copyQuotation, createQuotationFromRequest, declineQuotation, readDocument, type RequestMove, sendQuotation } from './service';

// Catering quotations (Q-12). Staff: create from a request, send, send again, a new version, a refusal by phone.
// Customer (through the link): accept and sign, or decline. Every step is in the quotation's history, and a change of
// the request's status in the request's history.

const logMail = (what: string) => (error: unknown) => console.error(`[mail] quotation ${what}`, error);
const href = (id: string) => `/admin/collections/quotations/${id}`;

/** The request's own history shows its status following its quotation ("Devis envoyé", accepted, declined). */
async function auditRequest(payload: Payload, move: RequestMove, user: string | null, ref: string | null | undefined) {
  if (!move) return;
  await audit(payload, { user, action: 'doc.update', collection: 'cateringRequests', id: move.id, ref: move.number, reason: ref ?? undefined, before: { status: move.from }, after: { status: move.to } });
}

export const createQuotationAction = action(z.object({ request: z.string().min(1) }), { roles: ['sales'] }, async ({ request }, { payload, user }) => {
  const q = await createQuotationFromRequest(payload, request);
  const source = await payload.findByID({ collection: 'cateringRequests', id: request, depth: 0, overrideAccess: true, select: { number: true } });
  await audit(payload, { user: user.id, action: 'quotation.created', collection: 'quotations', id: q.id, ref: q.title, reason: source.number });
  return { href: href(q.id) };
});

export const sendQuotationAction = action(z.object({ quotation: z.string().min(1) }), { roles: ['sales'] }, async ({ quotation }, { payload, user }) => {
  const { quotation: q, pdf, replaced, request } = await sendQuotation(payload, quotation);
  await audit(payload, { user: user.id, action: 'quotation.sent', collection: 'quotations', id: q.id, ref: q.number, after: { 'totals.totalCents': q.totals?.totalCents, validUntil: q.validUntil?.slice(0, 10), 'contact.email': q.contact.email } });
  for (const old of replaced) await audit(payload, { user: user.id, action: 'quotation.expired', collection: 'quotations', id: old.id, ref: old.number, reason: `→ ${q.number}` });
  await auditRequest(payload, request, user.id, q.number);
  after(() => mailQuotationSent(q, pdf).catch(logMail('sent')));
  return { status: q.status };
});

/** The same quotation e-mailed again (lost e-mail, another address after a correction by phone). */
export const resendQuotationAction = action(z.object({ quotation: z.string().min(1) }), { roles: ['sales'] }, async ({ quotation }, { payload, user }) => {
  const q = await payload.findByID({ collection: 'quotations', id: quotation, depth: 0, overrideAccess: true });
  if (q.status !== 'sent' && q.status !== 'viewed') throw new AppError('CONFLICT', 'notAcceptable');
  const file = q.pdf ? await readDocument(payload, String(typeof q.pdf === 'object' ? q.pdf.id : q.pdf)) : null;
  if (!file) throw new AppError('NOT_FOUND', 'pdf');
  await audit(payload, { user: user.id, action: 'quotation.sent', collection: 'quotations', id: q.id, ref: q.number, reason: q.contact.email });
  after(() => mailQuotationSent(q, file.buffer).catch(logMail('resent')));
  return { status: q.status };
});

export const copyQuotationAction = action(z.object({ quotation: z.string().min(1) }), { roles: ['sales'] }, async ({ quotation }, { payload, user }) => {
  const copy = await copyQuotation(payload, quotation);
  const from = await payload.findByID({ collection: 'quotations', id: quotation, depth: 0, overrideAccess: true, select: { number: true } });
  await audit(payload, { user: user.id, action: 'quotation.created', collection: 'quotations', id: copy.id, ref: copy.title, reason: from.number ?? undefined });
  return { href: href(copy.id) };
});

/** A refusal given by phone or e-mail, recorded by staff with its reason. */
export const declineQuotationByStaff = action(
  z.object({ quotation: z.string().min(1), reason: z.string().trim().min(3, 'reasonRequired').max(300, 'tooLong') }),
  { roles: ['sales'] },
  async ({ quotation, reason }, { payload, user }) => {
    const { quotation: q, request } = await declineQuotation(payload, quotation, { reason });
    await audit(payload, { user: user.id, action: 'quotation.declined', collection: 'quotations', id: q.id, ref: q.number, reason });
    await auditRequest(payload, request, user.id, q.number);
    return { status: q.status };
  },
);

// ---- The customer, through the link of the e-mail --------------------------------------------------------------

const linked = z.object({ quotation: z.string().regex(/^[a-f0-9]{24}$/), token: z.string().min(1) });
const checked = (input: { quotation: string; token: string }) => {
  if (!checkLinkToken('quotation', input.quotation, input.token)) throw new AppError('FORBIDDEN', 'link');
};

export const acceptQuotationAction = publicAction(
  linked.extend({
    name: z.string().trim().min(3, 'required').max(120, 'tooLong'),
    consent: z.literal('on', 'consent'),
  }),
  async ({ quotation, token, name }, { payload }) => {
    const ip = await clientIp();
    await rateLimit(`quotation:${ip}`, 10, 10 * 60_000);
    checked({ quotation, token });
    const userAgent = ((await headers()).get('user-agent') ?? '').slice(0, 300);
    const { quotation: q, pdf, request } = await acceptQuotation(payload, quotation, { name, ip, userAgent });
    await audit(payload, { action: 'quotation.accepted', collection: 'quotations', id: q.id, ref: q.number, after: { 'signature.name': name, 'signature.ip': ip } });
    await auditRequest(payload, request, null, q.number);
    after(() => mailQuotationSigned(q, pdf).catch(logMail('signed')));
    return { status: q.status };
  },
);

export const declineQuotationAction = publicAction(linked.extend({ reason: z.string().trim().max(300, 'tooLong').optional() }), async ({ quotation, token, reason }, { payload }) => {
  await rateLimit(`quotation:${await clientIp()}`, 10, 10 * 60_000);
  checked({ quotation, token });
  const { quotation: q, request } = await declineQuotation(payload, quotation, { reason: reason || undefined });
  await audit(payload, { action: 'quotation.declined', collection: 'quotations', id: q.id, ref: q.number, reason: reason || undefined });
  await auditRequest(payload, request, null, q.number);
  after(() => mailQuotationDeclined(q).catch(logMail('declined')));
  return { status: q.status };
});

// ---- B2B and invoicing (M3.2 T5): the staff who move orders (sales, managers) issue their documents. -------------------

const docRoles = { roles: ORDER_ROLES };
const logDoc = (what: string) => (error: unknown) => console.error(`[mail] ${what}`, error);
const lines = z.array(z.object({ variant: z.string().min(1).max(40), unit: z.string().min(1).max(40).optional(), qty: z.number().int().min(1).max(999) })).min(1).max(60);

/** A sold order's invoice (once), e-mailed to the customer with its PDF. */
export const issueInvoiceAction = action(z.object({ order: z.string().min(1) }), docRoles, async ({ order }, { payload, user }) => {
  const invoice = await issueInvoice(payload, order);
  if (invoice.createdAt === invoice.updatedAt) {
    await audit(payload, { user: user.id, action: 'invoice.issued', collection: 'invoices', id: invoice.id, ref: invoice.number, after: { 'totals.totalCents': invoice.totals?.totalCents } });
    after(() => mailBusinessDocument(payload, 'invoice', invoice.id).catch(logDoc('invoice')));
  }
  return { id: invoice.id, number: invoice.number, pdf: String(invoice.pdf) };
});

export const issueDeliveryNoteAction = action(z.object({ order: z.string().min(1) }), docRoles, async ({ order }, { payload, user }) => {
  const note = await issueDeliveryNote(payload, order);
  await audit(payload, { user: user.id, action: 'deliveryNote.issued', collection: 'deliveryNotes', id: note.id, ref: note.number });
  return { id: note.id, number: note.number, pdf: String(note.pdf) };
});

export const markInvoicePaidAction = action(z.object({ invoice: z.string().min(1) }), docRoles, async ({ invoice }, { payload, user }) => {
  const paid = await markInvoicePaid(payload, invoice, { user: user.id });
  await audit(payload, { user: user.id, action: 'invoice.paid', collection: 'invoices', id: paid.id, ref: paid.number });
  return { status: paid.status };
});

/** A credit note for what is left on an invoice (a correction, a refund handled outside an order), e-mailed. */
export const creditNoteAction = action(z.object({ invoice: z.string().min(1), reason: z.string().trim().min(3, 'reasonRequired').max(200, 'tooLong') }), docRoles, async ({ invoice, reason }, { payload, user }) => {
  const note = await issueCreditNote(payload, invoice, { reason });
  await audit(payload, { user: user.id, action: 'creditNote.issued', collection: 'creditNotes', id: note.id, ref: note.number, reason });
  after(() => mailBusinessDocument(payload, 'creditNote', note.id).catch(logDoc('credit note')));
  return { id: note.id, number: note.number };
});

/** A B2B quotation from the phone sale's lines: priced for the customer, numbered, e-mailed with its PDF. */
export const sendB2bQuotationAction = action(z.object({ customer: z.string().min(1).max(40), lines }), docRoles, async (input, { payload, user }) => {
  const { quotation, pdf } = await createB2bQuotation(payload, input);
  await audit(payload, { user: user.id, action: 'quotation.sent', collection: 'quotations', id: quotation.id, ref: quotation.number, after: { 'totals.totalCents': quotation.totals?.totalCents } });
  after(() => mailQuotationSent(quotation, pdf).catch(logMail('sent')));
  return { id: quotation.id, number: quotation.number ?? '' };
});

/** "Create order" on a B2B quotation: at the quoted prices, once (AC-M3.2-02). */
export const orderFromQuotationAction = action(z.object({ quotation: z.string().min(1) }), docRoles, async ({ quotation }, { payload, user }) => {
  const { order, quotation: q } = await orderFromQuotation(payload, quotation, { staff: user.id, staffName: user.name ?? user.email });
  await audit(payload, { user: user.id, action: 'quotation.order', collection: 'quotations', id: q.id, ref: q.number, reason: order });
  return { order };
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The accountant's file: every invoice and credit note issued in the period, net and VAT per rate (CSV for Excel). */
export const exportDocumentsAction = action(z.object({ from: day, to: day }).refine((r) => r.from <= r.to, { path: ['to'], message: 'range' }), { roles: ['manager'] }, async ({ from, to }, { payload }) => {
  const { headers, rows } = await exportDocuments(payload, from, to);
  return { name: `golden-grape-invoices-${from}-${to}.csv`, csv: toCsv(headers, rows), rows: rows.length };
});
