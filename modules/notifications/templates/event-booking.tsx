import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness } from './layout';

export type EventBookingMail = {
  title: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  locale: string;
  guests: number;
  amount?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string | null;
  /** Set on the payment e-mail only (§7): what was received and when. */
  payment?: { amount: string; on: string } | null;
};

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: EventBookingMail };

const rows = (t: Dictionary['mail'], d: EventBookingMail): [string, string | number][] => [
  [t.labels.event, d.title],
  [t.labels.date, d.date],
  [t.labels.guests, d.guests],
  ...(d.amount ? [[t.labels.amount, d.amount] as [string, string]] : []),
];

export function EventBookingCustomer({ t, business, logoUrl, data }: Props) {
  const e = t.eventBooking;
  const title = data.payment ? e.paymentSubject : data.status === 'cancelled' ? e.cancelledSubject : e.subject;
  const body = data.payment ? e.paymentBody : { pending: e.pendingBody, confirmed: e.confirmedBody, cancelled: e.cancelledBody }[data.status];
  // The payment e-mail: the event, the guests, what was paid and when, and the booking's final status.
  const details: [string, string | number][] = data.payment
    ? [...rows(t, { ...data, amount: null }), [t.labels.amountPaid, data.payment.amount], [t.labels.paidOn, data.payment.on], [t.labels.status, e.statusConfirmed]]
    : rows(t, data);
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(title, { title: data.title })}</h1>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{body}</p>
      <Details rows={details} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}

export function EventBookingStaff({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl} staff={t.staffBanner}>
      <h1 style={heading}>{interpolate(t.eventBooking.staffSubject, { title: data.title, name: data.name, guests: data.guests })}</h1>
      <Details
        rows={[
          ...rows(t, data),
          [t.labels.name, data.name],
          [t.labels.email, data.email],
          [t.labels.phone, data.phone],
          [t.labels.language, data.locale.toUpperCase()],
          [t.labels.notes, data.notes || '—'],
        ]}
      />
    </MailLayout>
  );
}
