import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness, Reference } from './layout';

// An invoice or a credit note sent to the customer (M3.2 T5), the PDF attached, in the customer's language.

export type DocumentMail = { kind: 'invoice' | 'creditNote'; number: string; name: string; total: string; due?: string | null; paid?: boolean; invoice?: string | null };

export function DocumentEmail({ t, business, logoUrl, data }: { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: DocumentMail }) {
  const invoice = data.kind === 'invoice';
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(invoice ? t.invoice.subject : t.creditNote.subject, { number: data.number })}</h1>
      <Reference>{data.number}</Reference>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{invoice ? t.invoice.body : interpolate(t.creditNote.body, { invoice: data.invoice ?? '' })}</p>
      <Details rows={[[t.invoice.total, data.total], ...(invoice && data.due && !data.paid ? [[t.invoice.dueLabel, data.due] as [string, string]] : [])]} />
      {invoice && <p>{data.paid ? t.invoice.paid : interpolate(t.invoice.due, { date: data.due ?? '' })}</p>}
      <p>{t.signature}</p>
    </MailLayout>
  );
}
