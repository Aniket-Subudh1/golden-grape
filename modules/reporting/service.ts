import type { Payload } from 'payload';
import { addDays, fromLocal, today } from '@/lib/time';
import { model } from '@/lib/tx';
import { SOLD, UNPAID } from '@/modules/sales/order-states';
import { lineGroups, periods, type Range, type SalesRow, type SalesTotals, type SoldLine, totals } from './summary';

// Sales figures (R8, M3.3 T4): read-only aggregations over `orders` (and their `payments`), no collection of its own.
// A sale counts on its slot day (`slot.date`, a Luxembourg calendar day), the day the order list filters by, so the
// figures for a range equal that list's totals (AC-M3.3-06). Fully refunded orders have status `refunded` and drop
// out; partial refunds are deducted. Built early for the dashboard's key figures; T4 adds the group-by.

// The statuses that make a sale and the payment states still owing live with the order states (one list).
export { SOLD, UNPAID };

export const GROUP_BY = ['day', 'channel', 'customer', 'product', 'brand', 'category'] as const;
export type GroupBy = (typeof GROUP_BY)[number];
export const CHANNELS = ['webshop', 'mobile', 'pos'] as const;
export type SalesQuery = Range & { channel?: (typeof CHANNELS)[number] };

const soldIn = ({ from, to, channel }: SalesQuery) => ({ 'slot.date': { $gte: from, $lte: to }, status: { $in: [...SOLD] }, ...(channel ? { channel } : {}) });

/** One aggregation row per `key` (null: every order): sums over the sold orders, the partly refunded ones listed. */
const orderRows = (payload: Payload, query: SalesQuery, key: string | null) =>
  model(payload, 'orders').aggregate<SalesRow & { _id: unknown }>([
    { $match: soldIn(query) },
    {
      $group: {
        _id: key,
        orders: { $sum: 1 },
        totalCents: { $sum: '$totals.totalCents' },
        vatCents: { $sum: '$totals.vatCents' },
        refunds: { $push: { refundedCents: { $ifNull: ['$payment.refundedCents', 0] }, vatCents: '$totals.vatCents', totalCents: '$totals.totalCents' } },
      },
    },
    { $set: { refunds: { $filter: { input: '$refunds', cond: { $gt: ['$$this.refundedCents', 0] } } } } },
  ]);

/** Totals of the orders sold over a range of Luxembourg days (inclusive), optionally for one channel. */
export async function salesSummary(payload: Payload, query: SalesQuery): Promise<SalesTotals> {
  return totals(await orderRows(payload, query, null));
}

export type SalesGroup = { key: string | null; label: string; orders: number; qty: number | null; grossCents: number; vatCents: number; netCents: number; refundedCents: number };

const nameIn = (name: unknown, locale: string) =>
  typeof name === 'string' ? name : name && typeof name === 'object' ? ((name as Record<string, string>)[locale] ?? (name as Record<string, string>).fr ?? '') : '';

/**
 * The dashboard's breakdown (R8, M3.3 T4) and its totals row. By day, channel or customer the groups are orders (each
 * with its refunds), so they add up to the totals. By product, brand or category they are the lines as charged (no
 * delivery fee, refunds only in the totals row). `null` key: no customer account, no brand.
 */
export async function salesBy(payload: Payload, query: SalesQuery & { groupBy: GroupBy; locale: string }) {
  const { groupBy, locale } = query;
  const total = await salesSummary(payload, query);
  let groups: SalesGroup[];
  if (groupBy === 'day' || groupBy === 'channel' || groupBy === 'customer') {
    const field = { day: '$slot.date', channel: '$channel', customer: '$customer' }[groupBy];
    const rows = await orderRows(payload, query, field);
    const ids = groupBy === 'customer' ? rows.map((r) => r._id).filter(Boolean) : [];
    const people = ids.length ? await model(payload, 'customers').find({ _id: { $in: ids } }, { name: 1, company: 1 }).lean<{ _id: unknown; name?: string; company?: string }[]>() : [];
    const who = new Map(people.map((c) => [String(c._id), c.company || c.name || '']));
    groups = rows.map((r) => {
      const key = r._id == null ? null : String(r._id);
      const t = totals([r]);
      return { key, label: groupBy === 'customer' ? (key ? (who.get(key) ?? '—') : '') : (key ?? ''), orders: t.orders, qty: null, grossCents: t.grossCents, vatCents: t.vatCents, netCents: t.netCents, refundedCents: t.refundedCents };
    });
    groups.sort((a, b) => (groupBy === 'day' ? (a.key ?? '').localeCompare(b.key ?? '') : b.grossCents - a.grossCents));
  } else {
    const field = { product: '$p._id', brand: '$p.brand', category: '$p.category' }[groupBy];
    const lines = await model(payload, 'orders').aggregate<SoldLine>([
      { $match: soldIn(query) },
      { $unwind: '$lines' },
      { $lookup: { from: 'variants', localField: 'lines.variant', foreignField: '_id', as: 'v', pipeline: [{ $project: { product: 1 } }] } },
      { $lookup: { from: 'products', localField: 'v.product', foreignField: '_id', as: 'p', pipeline: [{ $project: { brand: 1, category: 1 } }] } },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          key: { $ifNull: [{ $toString: field }, null] },
          order: { $toString: '$_id' },
          chargedCents: { $subtract: ['$lines.totalCents', { $ifNull: ['$lines.discountCents', 0] }] },
          vatBp: '$lines.vatBp',
          qty: '$lines.baseQty',
        },
      },
    ]);
    const folded = lineGroups(lines);
    const ids = folded.map((g) => g.key).filter(Boolean) as string[];
    const slug = ({ product: 'products', brand: 'brands', category: 'categories' } as const)[groupBy];
    const named = ids.length ? await model(payload, slug).find({ _id: { $in: ids } }, { name: 1 }).lean<{ _id: unknown; name?: unknown }[]>() : [];
    const label = new Map(named.map((d) => [String(d._id), nameIn(d.name, locale)]));
    groups = folded.map((g) => ({ ...g, label: g.key ? (label.get(g.key) ?? '—') : '', refundedCents: 0 }));
  }
  return { total, groups };
}

/** The breakdown as CSV (amounts in euros with two decimals, as the accountant's export). */
export function salesCsv(groups: SalesGroup[], total: SalesTotals, groupBy: GroupBy, labels: { none: string; total: string }) {
  const euros = (cents: number) => (cents / 100).toFixed(2);
  const rows = groups.map((g) => [g.label || labels.none, g.orders, g.qty ?? '', euros(g.grossCents), euros(g.vatCents), euros(g.netCents), euros(g.refundedCents)]);
  rows.push([labels.total, total.orders, '', euros(total.grossCents), euros(total.vatCents), euros(total.netCents), euros(total.refundedCents)]);
  return { headers: [groupBy, 'orders', 'bottles_or_units', 'gross', 'vat', 'net', 'refunded'], rows };
}

/** The instant a Luxembourg day (`YYYY-MM-DD`) starts. */
const dayStart = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return fromLocal(y, m, d);
};

/**
 * Money actually received on orders, less the refunds actually sent, by the day staff recorded (`payments.at`), over
 * a range of Luxembourg days: what the bank and the till show, apart from the value sold (QA 12 Nov, GG-21).
 */
export async function cashSummary(payload: Payload, { from, to }: Range) {
  const [row] = await model(payload, 'payments').aggregate<{ receivedCents: number; refundedCents: number }>([
    { $match: { kind: { $in: ['charge', 'refund'] }, at: { $gte: dayStart(from), $lt: dayStart(addDays(to, 1)) } } },
    {
      $group: {
        _id: null,
        receivedCents: { $sum: { $cond: [{ $eq: ['$kind', 'charge'] }, '$amountCents', 0] } },
        // Refund rows are negative amounts.
        refundedCents: { $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, { $multiply: ['$amountCents', -1] }, 0] } },
      },
    },
  ]);
  const receivedCents = row?.receivedCents ?? 0;
  const refundedCents = row?.refundedCents ?? 0;
  return { receivedCents, refundedCents, netCents: receivedCents - refundedCents };
}

/** What customers still owe on orders sold (confirmed to handed over): each order's total less what it received. */
export async function outstanding(payload: Payload) {
  const [row] = await model(payload, 'orders').aggregate<{ orders: number; dueCents: number }>([
    { $match: { status: { $in: [...SOLD] }, 'payment.status': { $in: [...UNPAID] } } },
    { $group: { _id: null, orders: { $sum: 1 }, dueCents: { $sum: { $max: [0, { $subtract: ['$totals.totalCents', { $ifNull: ['$payment.paidCents', 0] }] }] } } } },
  ]);
  return { orders: row?.orders ?? 0, dueCents: row?.dueCents ?? 0 };
}

/** Today against yesterday, this month so far against the same days of last month. */
export async function salesOverview(payload: Payload, now = new Date()) {
  const p = periods(today(now));
  const [[day, yesterday, month, lastMonth], [cash, lastCash], due] = await Promise.all([
    Promise.all([p.today, p.yesterday, p.month, p.lastMonth].map((range) => salesSummary(payload, range))),
    Promise.all([p.month, p.lastMonth].map((range) => cashSummary(payload, range))),
    outstanding(payload),
  ]);
  return { periods: p, today: day, yesterday, month, lastMonth, cash, lastCash, due };
}
