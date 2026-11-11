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
import { mailQuotationDeclined, mailQuotationSent, mailQuotationSigned } from './mail';
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
