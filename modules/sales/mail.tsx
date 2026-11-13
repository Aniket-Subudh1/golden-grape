import type { Payload } from 'payload';
import { appUrl } from '@/lib/env';
import { getDictionary, interpolate, type Locale } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { isBeforeSlot, slotLabel } from '@/lib/time';
import { mailContext } from '@/modules/notifications/context';
import { type OrderMail, OrderReceived, OrderStaff } from '@/modules/notifications/templates/order-received';
import { OrderStatusMail, type StatusMail } from '@/modules/notifications/templates/order-status';
import { type ReservationMail, type ReservationMailKind, ReservationCustomer, ReservationStaff } from '@/modules/notifications/templates/reservation';
import { dueOf } from '@/modules/payments/service';
import { formatIban, getSettingsPrivate } from '@/modules/settings/service';
import type { Order, Reservation } from '@/payload-types';
import { orderBankAccount, orderToken } from './service';

// Order and reservation e-mails (M2.3 T7). The customer's copy is in the order's language; the staff copy in French,
// to MAIL_STAFF_TO. Callers send them in after(), only when the transaction actually changed something.

const percent = (bp: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);
const localeOf = (doc: { locale?: string | null }) => (doc.locale ?? 'fr') as Locale;
const pageUrl = (id: string, locale: Locale) => `${appUrl()}/${locale}/order/${id}?t=${orderToken(id)}`;
const adminUrl = (collection: string, id: string) => `${appUrl()}/admin/collections/${collection}/${id}`;

async function orderMail(order: Order, locale: Locale, url: string): Promise<OrderMail> {
  const [{ mail: t }, { business }] = await Promise.all([getDictionary(locale), getSettingsPrivate()]);
  const money = (cents: number) => formatMoney(cents, locale);
  const totals = order.totals ?? { subtotalCents: 0, vatCents: 0, totalCents: 0 };
  const mode = (order.mode ?? 'pickup') as keyof typeof t.modes;
  const awaiting = order.status === 'awaiting_payment';
  const due = dueOf({ totalCents: totals.totalCents, paidCents: order.payment?.paidCents ?? 0, refundedCents: 0, refundDueCents: 0 });
  // The transfer details while a transfer is still due, also once staff prepared the order before it (GG-01).
  const transferDue = order.payment?.method === 'transfer' && due > 0 && order.status !== 'cancelled' && order.status !== 'refunded';
  const account = orderBankAccount(order, business.bankAccounts);
  const a = order.address;
  return {
    number: order.number ?? '',
    name: order.contact?.name ?? '',
    email: order.contact?.email ?? '',
    phone: order.contact?.phone ?? '',
    locale: localeOf(order),
    mode: t.modes[mode] ?? mode,
    slot: slotLabel(order.slot ?? {}, locale),
    address: mode === 'delivery' && a ? [a.line1, a.line2, `${a.postalCode} ${a.city}`].filter(Boolean).join(', ') : undefined,
    lines: (order.lines ?? []).map((l) => ({ name: l.name, detail: l.detail, qty: l.unitQty, total: money(l.totalCents) })),
    subtotal: money(totals.subtotalCents),
    delivery: totals.deliveryCents ? money(totals.deliveryCents) : null,
    total: money(totals.totalCents),
    vat: (totals.vatBreakdown ?? []).map((v) => ({ label: interpolate(t.labels.vat, { rate: percent(v.rateBp ?? 0, locale) }), amount: money(v.vatCents ?? 0) })),
    payment: t.payments[order.payment?.method ?? 'onsite'],
    awaiting,
    // GG-014: the reference and what is still due always; the bank details only when an account is configured.
    // Only this order's account (APPLUX, 12 Nov), never the list.
    transfer: transferDue
      ? {
          beneficiary: account?.holder || business.legalName || business.name,
          bank: account?.bankName,
          iban: account?.iban ? formatIban(account.iban) : null,
          bic: account?.bic,
          reference: order.number ?? '',
          amount: money(due),
        }
      : null,
    notes: order.notes,
    url,
  };
}

async function send(to: string | undefined, subject: string, html: Promise<{ html: string; text: string }>, replyTo?: string) {
  if (!to) {
    console.warn(`[mail] no MAIL_STAFF_TO or business e-mail: "${subject}" not sent`);
    return;
  }
  await sendMail({ to, subject, replyTo, ...(await html) });
}

/**
 * A new order: confirmation to the customer (with transfer details when relevant) and a copy to staff. `staff: false`:
 * the customer's copy again, after staff chose another bank account for the transfer.
 */
export async function mailOrderPlaced(order: Order, { staff: toStaff = true }: { staff?: boolean } = {}) {
  const locale = localeOf(order);
  const ctx = await mailContext(locale);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const [customer, staff] = await Promise.all([orderMail(order, locale, pageUrl(order.id, locale)), orderMail(order, 'fr', adminUrl('orders', order.id))]);
  const vars = { number: customer.number, name: customer.name };
  await Promise.all([
    send(customer.email, interpolate(ctx.customerT.order.subject, vars), render(<OrderReceived t={ctx.customerT} data={customer} {...shared} />)),
    ...(toStaff ? [send(ctx.staffTo, interpolate(ctx.staffT.order.staffSubject, vars), render(<OrderStaff t={ctx.staffT} data={staff} {...shared} />), customer.email)] : []),
  ]);
}

const TOLD = ['confirmed', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded'] as const;

/** The customer is told about a new state of their order (the state machine says which ones). */
export async function mailOrderStatus(order: Order) {
  if (!(TOLD as readonly string[]).includes(order.status ?? '')) return;
  const locale = localeOf(order);
  const ctx = await mailContext(locale);
  // The handover (GG-005) says "collected" or "delivered", by mode.
  const handedOver = order.status === 'completed' ? (order.mode === 'delivery' ? 'delivered' : 'completed') : null;
  const status = (handedOver ?? order.status) as StatusMail['status'];
  // Ready before the slot the customer chose (GG-027): say it can be collected now, and keep their time valid.
  const early = order.status === 'ready' && isBeforeSlot(order.slotAt);
  const statusName = handedOver
    ? ctx.customerT.order.handedOver[handedOver]
    : early
      ? ctx.customerT.order.readyEarlyName
      : ctx.customerT.status[order.status as keyof typeof ctx.customerT.status];
  const base = await orderMail(order, locale, pageUrl(order.id, locale));
  const data: StatusMail = { ...base, status, statusName, body: early ? interpolate(ctx.customerT.order.readyEarly, { slot: base.slot }) : undefined };
  await send(
    data.email,
    interpolate(ctx.customerT.order.statusSubject, { number: data.number, status: data.statusName }),
    render(<OrderStatusMail t={ctx.customerT} data={data} business={ctx.business} logoUrl={ctx.logoUrl} />),
  );
}

async function reservationMail(reservation: Reservation, preorder: Order | null, locale: Locale, url: string): Promise<ReservationMail> {
  return {
    number: reservation.number ?? '',
    name: reservation.contact?.name ?? '',
    email: reservation.contact?.email ?? '',
    phone: reservation.contact?.phone ?? '',
    locale: localeOf(reservation),
    slot: slotLabel({ date: reservation.slot?.date, from: reservation.slot?.from }, locale),
    guests: reservation.guests ?? 1,
    notes: reservation.notes,
    url,
    preorder: preorder ? await orderMail(preorder, locale, url) : null,
  };
}

/** A table request or a staff decision on it; `pending` also sends the staff copy. */
export async function mailReservation(payload: Payload, reservation: Reservation, kind: ReservationMailKind) {
  const preorderId = reservation.preorder ? (typeof reservation.preorder === 'object' ? reservation.preorder.id : reservation.preorder) : null;
  const preorder = preorderId ? await payload.findByID({ collection: 'orders', id: preorderId, depth: 0, overrideAccess: true, disableErrors: true }) : null;
  const locale = localeOf(reservation);
  const ctx = await mailContext(locale);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const data = await reservationMail(reservation, preorder, locale, pageUrl(reservation.id, locale));
  const r = ctx.customerT.reservation;
  const subject = { pending: r.pendingSubject, accepted: r.acceptedSubject, rejected: r.rejectedSubject, cancelled: r.cancelledSubject }[kind];
  const sends = [send(data.email, interpolate(subject, { number: data.number }), render(<ReservationCustomer t={ctx.customerT} data={data} kind={kind} {...shared} />))];
  if (kind === 'pending') {
    const staff = await reservationMail(reservation, preorder, 'fr', adminUrl('reservations', reservation.id));
    sends.push(
      send(
        ctx.staffTo,
        interpolate(ctx.staffT.reservation.staffSubject, { number: staff.number, name: staff.name, guests: staff.guests }),
        render(<ReservationStaff t={ctx.staffT} data={staff} {...shared} />),
        staff.email,
      ),
    );
  }
  await Promise.all(sends);
}
