import { type Dictionary, interpolate } from '@/lib/i18n';
import { colors, Details, heading, MailLayout, type MailBusiness } from './layout';
import { type OrderMail, OrderLines, ViewButton } from './order-received';

export type ReservationMailKind = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type ReservationMail = {
  number: string;
  name: string;
  email: string;
  phone: string;
  locale: string;
  slot: string;
  guests: number;
  notes?: string | null;
  url: string;
  /** The pre-order, formatted like an order. */
  preorder?: OrderMail | null;
};

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: ReservationMail };

const rows = (t: Dictionary['mail'], d: ReservationMail): [string, string | number][] => [
  [t.labels.number, d.number],
  [t.labels.slot, d.slot],
  [t.labels.guests, d.guests],
];

/** The customer's e-mail for a table request: received, accepted, declined or cancelled. */
export function ReservationCustomer({ t, business, logoUrl, data, kind }: Props & { kind: ReservationMailKind }) {
  const r = t.reservation;
  const title = { pending: r.pendingSubject, accepted: r.acceptedSubject, rejected: r.rejectedSubject, cancelled: r.cancelledSubject }[kind];
  const body = { pending: r.pendingBody, accepted: r.acceptedBody, rejected: r.rejectedBody, cancelled: r.cancelledBody }[kind];
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(title, { number: data.number })}</h1>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{body}</p>
      <Details rows={rows(t, data)} />
      {data.preorder && kind !== 'rejected' && kind !== 'cancelled' && (
        <>
          <p style={{ margin: '24px 0 0', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldDeep }}>{r.preorder}</p>
          <OrderLines t={t} data={data.preorder} />
        </>
      )}
      <ViewButton href={data.url} label={t.view} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}

export function ReservationStaff({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(t.reservation.staffSubject, { number: data.number, name: data.name, guests: data.guests })}</h1>
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
      {data.preorder && <OrderLines t={t} data={data.preorder} />}
      <ViewButton href={data.url} label={data.number} />
    </MailLayout>
  );
}
