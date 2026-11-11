import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness, Reference } from './layout';
import { ViewButton } from './order-received';

// Catering quotations (Q-12): the quotation sent to the customer (PDF attached, link to view and sign), the signed copy
// back to them, and staff told when a customer signs or declines.

export type QuotationMail = {
  number: string;
  name: string;
  total: string;
  validUntil: string;
  /** The customer's page (view, download, sign), or the quotation in the back office for staff. */
  href: string;
  event?: string | null;
  signedBy?: string | null;
  reason?: string | null;
};

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: QuotationMail };

export function QuotationSent({ t, business, logoUrl, data }: Props) {
  const q = t.quotation;
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(q.subject, { number: data.number })}</h1>
      <Reference>{data.number}</Reference>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{q.body}</p>
      <Details rows={[...(data.event ? [[t.labels.event, data.event] as [string, string]] : []), [t.labels.total, data.total]]} />
      <ViewButton href={data.href} label={q.button} />
      <p>{interpolate(q.validUntil, { date: data.validUntil })}</p>
      <p>{t.signature}</p>
    </MailLayout>
  );
}

export function QuotationSigned({ t, business, logoUrl, data }: Props) {
  const q = t.quotation;
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(q.acceptedSubject, { number: data.number })}</h1>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{q.acceptedBody}</p>
      <Details rows={[[t.labels.number, data.number], [t.labels.total, data.total], [q.signedBy, data.signedBy ?? data.name]]} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}

/** Staff: a customer signed or declined (French). */
export function QuotationStaff({ t, business, logoUrl, data, accepted }: Props & { accepted: boolean }) {
  const q = t.quotation;
  return (
    <MailLayout business={business} logoUrl={logoUrl} staff={t.staffBanner}>
      <h1 style={heading}>{interpolate(accepted ? q.staffAcceptedSubject : q.staffDeclinedSubject, { number: data.number, name: data.name })}</h1>
      <Details
        rows={[
          [t.labels.number, data.number],
          [t.labels.name, data.name],
          ...(data.event ? [[t.labels.event, data.event] as [string, string]] : []),
          [t.labels.total, data.total],
          ...(accepted ? [[q.signedBy, data.signedBy ?? '—'] as [string, string]] : [[q.reason, data.reason || '—'] as [string, string]]),
        ]}
      />
      <ViewButton href={data.href} label={q.open} />
    </MailLayout>
  );
}
