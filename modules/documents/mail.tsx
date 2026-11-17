import { appUrl } from '@/lib/env';
import { interpolate, type Locale, localePath } from '@/lib/i18n';
import { linkToken } from '@/lib/link-token';
import { render, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { mailContext } from '@/modules/notifications/context';
import { QuotationSent, QuotationSigned, QuotationStaff, type QuotationMail } from '@/modules/notifications/templates/quotation';
import type { Payload } from 'payload';
import { type DocumentMail, DocumentEmail } from '@/modules/notifications/templates/document';
import type { CreditNote, Invoice, Quotation } from '@/payload-types';
import { readDocument } from './service';

/** The customer's page of a quotation: whoever holds this link can view, download and sign it (lib/link-token.ts). */
export const quotationUrl = (q: Pick<Quotation, 'id' | 'locale'>) =>
  `${appUrl()}${localePath((q.locale ?? 'fr') as Locale, `/quotation/${q.id}`)}?t=${linkToken('quotation', q.id)}`;

const pdf = (number: string, content: Buffer, signed = false) => [{ filename: `${number}${signed ? '-signe' : ''}.pdf`, content, contentType: 'application/pdf' }];

function data(q: Quotation, l: Locale, href: string): QuotationMail {
  const day = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(l, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(v)) : '');
  return {
    number: q.number ?? '',
    name: q.contact?.name ?? '',
    total: formatMoney(q.totals?.totalCents ?? 0, l),
    validUntil: day(q.validUntil),
    href,
    event: [day(q.event?.date), q.event?.time, q.event?.location].filter(Boolean).join(' · ') || null,
    signedBy: q.signature?.name,
    reason: q.declineReason,
  };
}

/** Sending a quotation: the customer's e-mail in their language, with the PDF and the link to sign. */
export async function mailQuotationSent(q: Quotation, file: Buffer) {
  const locale = (q.locale ?? 'fr') as Locale;
  const ctx = await mailContext(locale);
  const d = data(q, locale, quotationUrl(q));
  const html = await render(<QuotationSent t={ctx.customerT} data={d} business={ctx.business} logoUrl={ctx.logoUrl} />);
  await sendMail({ to: q.contact.email, subject: interpolate(ctx.customerT.quotation.subject, { number: d.number }), ...html, attachments: pdf(d.number, file) });
}

/** Signed: the signed copy to the customer, and staff told (French) with a link to the quotation in the admin. */
export async function mailQuotationSigned(q: Quotation, file: Buffer) {
  const locale = (q.locale ?? 'fr') as Locale;
  const ctx = await mailContext(locale);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const d = data(q, locale, quotationUrl(q));
  const sends = [
    render(<QuotationSigned t={ctx.customerT} data={d} {...shared} />).then((html) =>
      sendMail({ to: q.contact.email, subject: interpolate(ctx.customerT.quotation.acceptedSubject, { number: d.number }), ...html, attachments: pdf(d.number, file, true) }),
    ),
  ];
  if (ctx.staffTo) sends.push(mailStaff(q, true, ctx.staffTo));
  await Promise.all(sends);
}

/** Declined by the customer: staff told (French). */
export async function mailQuotationDeclined(q: Quotation) {
  const ctx = await mailContext('fr');
  if (ctx.staffTo) await mailStaff(q, false, ctx.staffTo);
}

async function mailStaff(q: Quotation, accepted: boolean, to: string) {
  const ctx = await mailContext('fr');
  const d = data(q, 'fr', `${appUrl()}/admin/collections/quotations/${q.id}`);
  const html = await render(<QuotationStaff t={ctx.staffT} data={d} business={ctx.business} logoUrl={ctx.logoUrl} accepted={accepted} />);
  await sendMail({ to, replyTo: q.contact.email, subject: interpolate(accepted ? ctx.staffT.quotation.staffAcceptedSubject : ctx.staffT.quotation.staffDeclinedSubject, { number: d.number, name: d.name }), ...html });
}

/**
 * An invoice or a credit note to the customer, its PDF attached, in the document's language (after commit). A customer
 * without an e-mail (created at the till) gets nothing: the PDF is printed or downloaded from the order.
 */
export async function mailBusinessDocument(payload: Payload, kind: 'invoice' | 'creditNote', id: string) {
  const doc = await payload.findByID({ collection: kind === 'invoice' ? 'invoices' : 'creditNotes', id, depth: 1, overrideAccess: true, disableErrors: true });
  const to = doc?.billing?.email;
  if (!doc || !to) return false;
  const locale = (doc.locale ?? 'fr') as Locale;
  const ctx = await mailContext(locale);
  const file = await readDocument(payload, String(typeof doc.pdf === 'object' ? doc.pdf?.id : doc.pdf));
  if (!file) return false;
  const day = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(v)) : null);
  const invoice = kind === 'invoice' ? (doc as Invoice) : null;
  const credited = kind === 'creditNote' ? (doc as CreditNote) : null;
  const data: DocumentMail = {
    kind,
    number: doc.number,
    name: doc.billing?.name ?? '',
    total: formatMoney(doc.totals?.totalCents ?? 0, locale),
    due: day(invoice?.dueAt),
    paid: invoice?.status === 'paid',
    invoice: credited && typeof credited.invoice === 'object' ? credited.invoice?.number : null,
  };
  const html = await render(<DocumentEmail t={ctx.customerT} business={ctx.business} logoUrl={ctx.logoUrl} data={data} />);
  const subject = interpolate(kind === 'invoice' ? ctx.customerT.invoice.subject : ctx.customerT.creditNote.subject, { number: doc.number });
  await sendMail({ to, subject, ...html, attachments: pdf(doc.number, file.buffer) });
  return true;
}
