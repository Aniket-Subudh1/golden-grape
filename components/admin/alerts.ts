import type { Payload, TypedUser, Where } from 'payload';
import { hasRole } from '@/lib/access';
import type { Label } from '@/lib/admin';
import { add } from '@/lib/money';
import { REQUEST_STATUS } from '@/modules/catering/collections';
import { QUOTATION_STATUS } from '@/modules/documents/collections';
import { dueOf } from '@/modules/payments/service';
import { BOOKING_STATUS } from '@/modules/events/collections';
import { ORDER_TABS, orderTabWhere } from '@/modules/sales/admin/order-tabs';
import { ORDER_STATUS_LABELS, RESERVATION_STATUS_LABELS } from '@/modules/sales/collections';

// What waits for staff (GG-002, GG-017): the counts beside the sidebar items and the bell's list. Only what the
// user's role may open is counted. Orders count as waiting exactly when they sit in the Orders "To do" tab.
// Each bell line has a state:
// - `pending`: needs a decision (an order to confirm, a table to accept, a request to answer, a refund to send…);
//   it stays until someone handles it, and is "new" until the bell is opened after it arrived;
// - `info`: arrived and needs nothing (a free event seat, confirmed at once): "new" once, then just listed;
// - `done`: handled in the last 24 hours, shown greyed with its status. Never counted in any badge.
// Callers: the sidebar (nav.tsx, first paint) and `loadAlerts` (alerts-action.ts, the bell's refresh).
// The dashboard's tiles (`actionCounts` below) use the same conditions, so every place shows the same figure (GG-045).

export type AlertKind = 'order' | 'reservation' | 'booking' | 'catering' | 'quotation' | 'refund' | 'lowStock';
export type AlertState = 'pending' | 'info' | 'done';
export type AlertItem = {
  kind: AlertKind;
  state: AlertState;
  key: string;
  href: string;
  ref: string;
  name: string;
  /** When it arrived (pending, info) or was handled (done). */
  at: string;
  slot?: { date: string; from?: string };
  count?: number;
  awaitingTransfer?: boolean;
  /** A table reservation that carries a pre-order (APPLUX audit 10 Nov, §2). */
  preorder?: boolean;
  /** The status a handled item ended in, in the four admin languages. */
  status?: Label;
};
export type Alerts = { counts: Record<string, number>; items: AlertItem[] };

const LIST = 8;
const RECENT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const TODO = ORDER_TABS[0].statuses ?? [];

type Collection = 'orders' | 'reservations' | 'eventBookings' | 'cateringRequests' | 'quotations';

/** What waits for staff, per list. Orders wait exactly when they sit in the Orders "To do" tab. */
const WAITING = {
  orders: { and: orderTabWhere(ORDER_TABS[0]) },
  reservations: { status: { equals: 'pending' } },
  eventBookings: { status: { equals: 'pending' } },
  cateringRequests: { status: { equals: 'new' } },
  // Money owed back (GG-004): pending until "Refund sent" is recorded.
  refunds: { 'payment.status': { equals: 'refund_pending' } },
} satisfies Record<string, Where>;
type Doc = {
  id: string;
  status?: string | null;
  number?: string | null;
  /** Event bookings: "Noite de Fado · Hans Müller (2 places)" (they have no number, §15). */
  label?: string | null;
  contact?: { name?: string | null } | null;
  createdAt: string;
  updatedAt: string;
  slot?: { date?: string | null; from?: string | null } | null;
  preorder?: unknown;
};

const LABELS: Record<Collection, Record<string, Label>> = {
  orders: ORDER_STATUS_LABELS,
  reservations: RESERVATION_STATUS_LABELS,
  eventBookings: BOOKING_STATUS,
  cateringRequests: Object.fromEntries(REQUEST_STATUS.map((s) => [s.value, s.label])),
  quotations: QUOTATION_STATUS,
};

const toItems = (kind: AlertKind, collection: Collection, state: AlertState, docs: Doc[]): AlertItem[] =>
  docs.map((d) => ({
    kind,
    state,
    key: `${kind}-${d.id}`,
    href: `/admin/collections/${collection}/${d.id}`,
    ref: d.number ?? d.label ?? '',
    name: d.label ? '' : (d.contact?.name ?? ''),
    at: state === 'done' ? d.updatedAt : d.createdAt,
    slot: d.slot?.date ? { date: d.slot.date, from: d.slot.from ?? undefined } : undefined,
    awaitingTransfer: d.status === 'awaiting_payment' || undefined,
    preorder: (collection === 'reservations' && Boolean(d.preorder)) || undefined,
    // Handled lines show how they ended; a quotation's line (info) says whether it was signed or declined.
    status: (state === 'done' || collection === 'quotations') && d.status ? LABELS[collection][d.status] : undefined,
  }));

export async function getAlerts(payload: Payload, user: TypedUser | null, now = new Date()): Promise<Alerts> {
  const sales = hasRole(user, ['sales']);
  const stock = hasRole(user, ['manager', 'stock']);
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const find = (collection: Collection, where: object, sort = '-createdAt', limit = LIST) =>
    sales ? payload.find({ collection, where: where as never, sort, limit, depth: 0, overrideAccess: true, pagination: true }) : null;
  const recent = (collection: Collection, notIn: string[]) =>
    find(collection, { and: [{ updatedAt: { greater_than_equal: since } }, { status: { not_in: notIn } }] }, '-updatedAt', RECENT);

  const [orders, reservations, bookings, catering, refunds, freeSeats, doneOrders, doneReservations, doneBookings, doneCatering, lowStock, answered] =
    await Promise.all([
      find('orders', WAITING.orders),
      find('reservations', WAITING.reservations),
      find('eventBookings', WAITING.eventBookings),
      find('cateringRequests', WAITING.cateringRequests),
      find('orders', WAITING.refunds),
      // Free events confirm a booking at once: staff are told it arrived, nothing to do.
      find('eventBookings', { and: [{ status: { equals: 'confirmed' } }, { createdAt: { greater_than_equal: since } }] }),
      recent('orders', TODO),
      recent('reservations', ['pending']),
      recent('eventBookings', ['pending']),
      recent('cateringRequests', ['new']),
      stock ? payload.count({ collection: 'stockLevels', where: { lowStock: { equals: true } }, overrideAccess: true }) : null,
      // A customer signed or declined a catering quotation in the last 24 hours (Q-12): staff are told, nothing waits.
      find('quotations', { and: [{ status: { in: ['accepted', 'declined'] } }, { updatedAt: { greater_than_equal: since } }] }, '-updatedAt', RECENT),
    ]);

  const counts: Record<string, number> = {};
  if (orders) counts.orders = orders.totalDocs;
  if (reservations) counts.reservations = reservations.totalDocs;
  if (bookings) counts.eventBookings = bookings.totalDocs;
  if (catering) counts.cateringRequests = catering.totalDocs;
  if (lowStock) counts.stockLevels = lowStock.totalDocs;

  const docs = (r: { docs: unknown[] } | null) => (r?.docs ?? []) as Doc[];
  const waiting = [
    ...toItems('order', 'orders', 'pending', docs(orders)),
    ...toItems('reservation', 'reservations', 'pending', docs(reservations)),
    ...toItems('booking', 'eventBookings', 'pending', docs(bookings)),
    ...toItems('catering', 'cateringRequests', 'pending', docs(catering)),
    ...toItems('refund', 'orders', 'pending', docs(refunds)).map((i) => ({ ...i, key: `refund-${i.key}` })),
    ...toItems('booking', 'eventBookings', 'info', docs(freeSeats)),
    ...toItems('quotation', 'quotations', 'info', docs(answered)),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIST);
  // One line per document: a free seat booked today is listed as info, a completed order with a refund to send as that
  // refund; neither appears again as "handled".
  const listed = new Set(waiting.map((i) => i.href));
  const done = [
    ...toItems('order', 'orders', 'done', docs(doneOrders)),
    ...toItems('reservation', 'reservations', 'done', docs(doneReservations)),
    ...toItems('booking', 'eventBookings', 'done', docs(doneBookings)),
    ...toItems('catering', 'cateringRequests', 'done', docs(doneCatering)),
  ]
    .filter((i) => !listed.has(i.href))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT);

  const items = [...waiting];
  // Low stock is a state, not an event: one pending line, undated so it is never "new".
  if (lowStock?.totalDocs) {
    items.push({ kind: 'lowStock', state: 'pending', key: 'lowStock', href: '/admin/collections/stockLevels?where[lowStock][equals]=true', ref: '', name: '', at: '', count: lowStock.totalDocs });
  }
  return { counts, items: [...items, ...done] };
}

// ---------------------------------------------------------------------------------------------------------------
// The dashboard's waiting tiles (GG-045): per thing staff can act on, how many, what they add up to (euros, or guests
// for tables and event seats), how long the oldest has waited, and the list it opens.

export type CounterKey = 'toConfirm' | 'awaitingPayment' | 'toPrepare' | 'reservations' | 'catering' | 'eventBookings' | 'refunds';
export type ActionCount = { key: CounterKey; count: number; href: string; sum: number; unit: 'cents' | 'guests'; oldestAt?: string };

export const listUrl = (collection: string, query: Record<string, string>) => `/admin/collections/${collection}?${new URLSearchParams(query)}`;

type Waiting = {
  createdAt: string;
  updatedAt: string;
  guests?: number | null;
  estimateCents?: number | null;
  totals?: { totalCents?: number | null } | null;
  payment?: { paidCents?: number | null; refundedCents?: number | null; refundDueCents?: number | null } | null;
};
type Counter = {
  key: CounterKey;
  collection: Exclude<Collection, 'quotations'>;
  where: Where;
  href: string;
  unit: ActionCount['unit'];
  value: (d: Waiting) => number;
  /** When it entered this stage: `updatedAt` for a stage reached later in the order's life, else `createdAt`. */
  since?: 'updatedAt';
};

const total = (d: Waiting) => d.totals?.totalCents ?? 0;
const guests = (d: Waiting) => d.guests ?? 0;
const TODO_URL = { 'where[and][1][mode][not_equals]': 'table', sort: 'slotAt' };
const COUNTERS: Counter[] = [
  // Orders split by what staff do next: confirm, check the bank for the transfer, prepare.
  {
    key: 'toConfirm',
    collection: 'orders',
    where: { and: [...WAITING.orders.and, { status: { equals: 'pending' } }] },
    href: listUrl('orders', { 'where[and][0][status][in][0]': 'pending', ...TODO_URL }),
    unit: 'cents',
    value: total,
  },
  {
    key: 'awaitingPayment',
    collection: 'orders',
    where: { and: [...WAITING.orders.and, { status: { equals: 'awaiting_payment' } }] },
    href: listUrl('orders', { 'where[and][0][status][in][0]': 'awaiting_payment', ...TODO_URL }),
    unit: 'cents',
    // What to look for on the bank statement.
    value: (d) => dueOf({ totalCents: total(d), paidCents: d.payment?.paidCents ?? 0, refundedCents: d.payment?.refundedCents ?? 0, refundDueCents: 0 }),
  },
  {
    key: 'toPrepare',
    collection: 'orders',
    where: { and: orderTabWhere(ORDER_TABS[1]) },
    href: listUrl('orders', { 'where[and][0][status][in][0]': 'confirmed', sort: 'slotAt' }),
    unit: 'cents',
    value: total,
    since: 'updatedAt',
  },
  { key: 'reservations', collection: 'reservations', where: WAITING.reservations, href: listUrl('reservations', { 'where[status][equals]': 'pending', sort: 'slotAt' }), unit: 'guests', value: guests },
  { key: 'catering', collection: 'cateringRequests', where: WAITING.cateringRequests, href: listUrl('cateringRequests', { 'where[status][equals]': 'new' }), unit: 'cents', value: (d) => d.estimateCents ?? 0 },
  { key: 'eventBookings', collection: 'eventBookings', where: WAITING.eventBookings, href: listUrl('eventBookings', { 'where[status][equals]': 'pending' }), unit: 'guests', value: guests },
  {
    key: 'refunds',
    collection: 'orders',
    where: WAITING.refunds,
    href: listUrl('orders', { 'where[payment.status][equals]': 'refund_pending' }),
    unit: 'cents',
    value: (d) => d.payment?.refundDueCents ?? 0,
    since: 'updatedAt',
  },
];

const SELECT = {
  orders: { totals: { totalCents: true }, payment: { paidCents: true, refundedCents: true, refundDueCents: true }, createdAt: true, updatedAt: true },
  reservations: { guests: true, createdAt: true, updatedAt: true },
  eventBookings: { guests: true, createdAt: true, updatedAt: true },
  cateringRequests: { estimateCents: true, createdAt: true, updatedAt: true },
} satisfies Record<Exclude<Collection, 'quotations'>, object>;

export async function actionCounts(payload: Payload, user: TypedUser | null): Promise<ActionCount[]> {
  if (!hasRole(user, ['sales'])) return [];
  const found = await Promise.all(
    COUNTERS.map((c) => payload.find({ collection: c.collection, where: c.where, select: SELECT[c.collection] as never, limit: 0, depth: 0, overrideAccess: true })),
  );
  return COUNTERS.map((c, i) => {
    const docs = found[i].docs as unknown as Waiting[];
    const since = docs.map((d) => d[c.since ?? 'createdAt']).sort();
    return { key: c.key, count: docs.length, href: c.href, sum: add(...docs.map(c.value)), unit: c.unit, oldestAt: since[0] };
  });
}
