import type { Payload, TypedUser } from 'payload';
import { hasRole } from '@/lib/access';
import type { Label } from '@/lib/admin';
import { REQUEST_STATUS } from '@/modules/catering/collections';
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

export type AlertKind = 'order' | 'reservation' | 'booking' | 'catering' | 'refund' | 'lowStock';
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
  /** The status a handled item ended in, in the four admin languages. */
  status?: Label;
};
export type Alerts = { counts: Record<string, number>; items: AlertItem[] };

const LIST = 8;
const RECENT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const TODO = ORDER_TABS[0].statuses ?? [];

type Collection = 'orders' | 'reservations' | 'eventBookings' | 'cateringRequests';
type Doc = {
  id: string;
  status?: string | null;
  number?: string | null;
  contact?: { name?: string | null } | null;
  createdAt: string;
  updatedAt: string;
  slot?: { date?: string | null; from?: string | null } | null;
};

const LABELS: Record<Collection, Record<string, Label>> = {
  orders: ORDER_STATUS_LABELS,
  reservations: RESERVATION_STATUS_LABELS,
  eventBookings: BOOKING_STATUS,
  cateringRequests: Object.fromEntries(REQUEST_STATUS.map((s) => [s.value, s.label])),
};

const toItems = (kind: AlertKind, collection: Collection, state: AlertState, docs: Doc[]): AlertItem[] =>
  docs.map((d) => ({
    kind,
    state,
    key: `${kind}-${d.id}`,
    href: `/admin/collections/${collection}/${d.id}`,
    ref: d.number ?? '',
    name: d.contact?.name ?? '',
    at: state === 'done' ? d.updatedAt : d.createdAt,
    slot: d.slot?.date ? { date: d.slot.date, from: d.slot.from ?? undefined } : undefined,
    awaitingTransfer: d.status === 'awaiting_payment' || undefined,
    status: state === 'done' && d.status ? LABELS[collection][d.status] : undefined,
  }));

export async function getAlerts(payload: Payload, user: TypedUser | null, now = new Date()): Promise<Alerts> {
  const sales = hasRole(user, ['sales']);
  const stock = hasRole(user, ['manager', 'stock']);
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const find = (collection: Collection, where: object, sort = '-createdAt', limit = LIST) =>
    sales ? payload.find({ collection, where: where as never, sort, limit, depth: 0, overrideAccess: true, pagination: true }) : null;
  const recent = (collection: Collection, notIn: string[]) =>
    find(collection, { and: [{ updatedAt: { greater_than_equal: since } }, { status: { not_in: notIn } }] }, '-updatedAt', RECENT);

  const [orders, reservations, bookings, catering, refunds, freeSeats, doneOrders, doneReservations, doneBookings, doneCatering, lowStock] =
    await Promise.all([
      find('orders', { and: orderTabWhere(ORDER_TABS[0]) }),
      find('reservations', { status: { equals: 'pending' } }),
      find('eventBookings', { status: { equals: 'pending' } }),
      find('cateringRequests', { status: { equals: 'new' } }),
      // Money owed back (GG-004): pending until "Refund sent" is recorded.
      find('orders', { 'payment.status': { equals: 'refund_pending' } }),
      // Free events confirm a booking at once: staff are told it arrived, nothing to do.
      find('eventBookings', { and: [{ status: { equals: 'confirmed' } }, { createdAt: { greater_than_equal: since } }] }),
      recent('orders', TODO),
      recent('reservations', ['pending']),
      recent('eventBookings', ['pending']),
      recent('cateringRequests', ['new']),
      stock ? payload.count({ collection: 'stockLevels', where: { lowStock: { equals: true } }, overrideAccess: true }) : null,
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
