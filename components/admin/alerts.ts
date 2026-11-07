import type { Payload, TypedUser } from 'payload';
import { hasRole } from '@/lib/access';
import { ORDER_TABS } from '@/modules/sales/admin/order-tabs';

// What waits for staff (GG-002): the counts beside the sidebar items and the bell's list. Only what the user's role
// may open is counted. Orders count as waiting exactly when they sit in the Orders "To do" tab (order-tabs.tsx).
// Callers: the sidebar (nav.tsx, first paint) and `loadAlerts` (alerts-action.ts, the bell's refresh).

export type AlertKind = 'order' | 'reservation' | 'booking' | 'catering' | 'lowStock';
export type AlertItem = {
  kind: AlertKind;
  key: string;
  href: string;
  ref: string;
  name: string;
  at: string;
  slot?: { date: string; from?: string };
  count?: number;
  awaitingTransfer?: boolean;
};
export type Alerts = { counts: Record<string, number>; items: AlertItem[] };

const LIST = 8;
const TODO = ORDER_TABS[0].statuses ?? [];
type Contact = { name?: string | null } | null | undefined;
type Doc = {
  id: string;
  status?: string | null;
  number?: string | null;
  contact?: Contact;
  createdAt: string;
  slot?: { date?: string | null; from?: string | null } | null;
};

const toItems = (kind: AlertKind, collection: string, docs: Doc[]): AlertItem[] =>
  docs.map((d) => ({
    kind,
    key: `${kind}-${d.id}`,
    href: `/admin/collections/${collection}/${d.id}`,
    ref: d.number ?? '',
    name: d.contact?.name ?? '',
    at: d.createdAt,
    slot: d.slot?.date ? { date: d.slot.date, from: d.slot.from ?? undefined } : undefined,
    awaitingTransfer: d.status === 'awaiting_payment' || undefined,
  }));

export async function getAlerts(payload: Payload, user: TypedUser | null): Promise<Alerts> {
  const sales = hasRole(user, ['sales']);
  const stock = hasRole(user, ['manager', 'stock']);
  const find = (collection: 'orders' | 'reservations' | 'eventBookings' | 'cateringRequests', where: object) =>
    payload.find({
      collection,
      where: where as never,
      sort: '-createdAt',
      limit: LIST,
      depth: 0,
      overrideAccess: true,
      pagination: true,
    });

  const [orders, reservations, bookings, catering, lowStock] = await Promise.all([
    sales ? find('orders', { status: { in: TODO } }) : null,
    sales ? find('reservations', { status: { equals: 'pending' } }) : null,
    sales ? find('eventBookings', { status: { equals: 'pending' } }) : null,
    sales ? find('cateringRequests', { status: { equals: 'new' } }) : null,
    stock
      ? payload.count({ collection: 'stockLevels', where: { lowStock: { equals: true } }, overrideAccess: true })
      : null,
  ]);

  const counts: Record<string, number> = {};
  if (orders) counts.orders = orders.totalDocs;
  if (reservations) counts.reservations = reservations.totalDocs;
  if (bookings) counts.eventBookings = bookings.totalDocs;
  if (catering) counts.cateringRequests = catering.totalDocs;
  if (lowStock) counts.stockLevels = lowStock.totalDocs;

  const items = [
    ...toItems('order', 'orders', (orders?.docs ?? []) as Doc[]),
    ...toItems('reservation', 'reservations', (reservations?.docs ?? []) as Doc[]),
    ...toItems('booking', 'eventBookings', (bookings?.docs ?? []) as Doc[]),
    ...toItems('catering', 'cateringRequests', (catering?.docs ?? []) as Doc[]),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIST);
  // Low stock is a state, not an event: one line at the end, undated so it never counts as "new".
  if (lowStock?.totalDocs) {
    items.push({
      kind: 'lowStock',
      key: 'lowStock',
      href: '/admin/collections/stockLevels?where[lowStock][equals]=true',
      ref: '',
      name: '',
      at: '',
      count: lowStock.totalDocs,
    });
  }
  return { counts, items };
}
