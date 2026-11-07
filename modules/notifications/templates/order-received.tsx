import type { CSSProperties } from 'react';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { colors, Details, heading, MailLayout, type MailBusiness, Reference } from './layout';

// Order e-mails: what the customer receives when the order is placed, the staff copy, and the shared pieces
// (items and totals, transfer details, the button to the order page) reused by order-status and reservation.

type T = Dictionary['mail'];

/** An order, already formatted in the reader's language (amounts with formatMoney, the slot with slotLabel). */
export type OrderMail = {
  number: string;
  name: string;
  email: string;
  phone: string;
  locale: string;
  mode: string;
  slot: string;
  address?: string;
  lines: { name: string; detail?: string | null; qty: number; total: string }[];
  subtotal: string;
  delivery?: string | null;
  total: string;
  vat: { label: string; amount: string }[];
  payment: string;
  /** Waiting for a bank transfer. */
  awaiting: boolean;
  /** How to pay by transfer. Without an IBAN in the settings, only the reference and amount (staff send the bank details: GG-014). */
  transfer?: { beneficiary: string; iban?: string | null; bic?: string | null; reference: string; amount: string } | null;
  notes?: string | null;
  url: string;
};

type Props = { t: T; business: MailBusiness; logoUrl: string; data: OrderMail };

const cell: CSSProperties = { padding: '10px 0', borderBottom: `1px solid ${colors.champagne}`, fontSize: 14, verticalAlign: 'top' };
const right: CSSProperties = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };

/** Items with quantities and line totals, then subtotal, delivery, total and the VAT included. */
export function OrderLines({ t, data }: { t: T; data: OrderMail }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '24px 0', borderTop: `1px solid ${colors.champagne}` }}>
      <tbody>
        {data.lines.map((l, i) => (
          <tr key={i}>
            <td style={{ ...cell, width: 36, color: colors.muted }}>{l.qty} ×</td>
            <td style={cell}>
              {l.name}
              {l.detail && <span style={{ display: 'block', fontSize: 12, color: colors.muted }}>{l.detail}</span>}
            </td>
            <td style={right}>{l.total}</td>
          </tr>
        ))}
        <tr>
          <td />
          <td style={{ ...cell, color: colors.muted }}>{t.labels.subtotal}</td>
          <td style={right}>{data.subtotal}</td>
        </tr>
        {data.delivery && (
          <tr>
            <td />
            <td style={{ ...cell, color: colors.muted }}>{t.labels.delivery}</td>
            <td style={right}>{data.delivery}</td>
          </tr>
        )}
        <tr>
          <td />
          <td style={{ ...cell, fontWeight: 700 }}>{t.labels.total}</td>
          <td style={{ ...right, fontWeight: 700, fontSize: 16 }}>{data.total}</td>
        </tr>
        {data.vat.map((v) => (
          <tr key={v.label}>
            <td />
            <td style={{ padding: '4px 0', fontSize: 12, color: colors.muted }}>{v.label}</td>
            <td style={{ padding: '4px 0', fontSize: 12, color: colors.muted, textAlign: 'right' }}>{v.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TransferDetails({ t, transfer }: { t: T; transfer: NonNullable<OrderMail['transfer']> }) {
  return (
    <div style={{ margin: '24px 0', padding: '18px 20px', background: colors.champagne }}>
      <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldDeep }}>{t.order.transferTitle}</p>
      <Details
        rows={[
          ...(transfer.iban
            ? ([
                [t.labels.beneficiary, transfer.beneficiary],
                [t.labels.iban, transfer.iban],
                ...(transfer.bic ? [[t.labels.bic, transfer.bic]] : []),
              ] as [string, string][])
            : []),
          [t.labels.reference, <b key="ref">{transfer.reference}</b>],
          [t.labels.amount, <b key="amount">{transfer.amount}</b>],
        ]}
      />
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{transfer.iban ? t.order.transferNote : t.order.transferMissing}</p>
    </div>
  );
}

export function ViewButton({ href, label }: { href: string; label: string }) {
  return (
    <p style={{ margin: '28px 0' }}>
      <a href={href} style={{ display: 'inline-block', padding: '14px 28px', background: colors.ink, color: colors.bone, textDecoration: 'none', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </a>
    </p>
  );
}

const summaryRows = (t: T, d: OrderMail): [string, string][] => [
  [t.labels.number, d.number],
  [t.labels.mode, d.mode],
  [t.labels.slot, d.slot],
  ...(d.address ? [[t.labels.address, d.address] as [string, string]] : []),
  [t.labels.payment, d.payment],
];

export function OrderReceived({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{t.order.title}</h1>
      <Reference>{interpolate(t.order.reference, { number: data.number })}</Reference>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{data.awaiting ? t.order.awaitingBody : t.order.confirmedBody}</p>
      <Details rows={summaryRows(t, data)} />
      {data.transfer && <TransferDetails t={t} transfer={data.transfer} />}
      <OrderLines t={t} data={data} />
      <ViewButton href={data.url} label={t.view} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}

/** The shop's copy (GG-012): marked internal, its own title and wording, sent to the shop's inbox only. */
export function OrderStaff({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl} staff={t.staffBanner}>
      <h1 style={heading}>{t.order.staffTitle}</h1>
      <Reference>{interpolate(t.order.reference, { number: data.number })}</Reference>
      <p>{t.order.staffIntro}</p>
      {data.awaiting && !data.transfer?.iban && <p style={{ padding: '12px 16px', background: colors.champagne, fontWeight: 700 }}>{t.order.staffTransferMissing}</p>}
      <Details
        rows={[
          ...summaryRows(t, data),
          [t.labels.name, data.name],
          [t.labels.email, data.email],
          [t.labels.phone, data.phone],
          [t.labels.language, data.locale.toUpperCase()],
          [t.labels.notes, data.notes || '—'],
        ]}
      />
      <OrderLines t={t} data={data} />
      <ViewButton href={data.url} label={data.number} />
    </MailLayout>
  );
}
