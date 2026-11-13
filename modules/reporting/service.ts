import type { Payload } from 'payload';
import { addDays, fromLocal, today } from '@/lib/time';
import { model } from '@/lib/tx';
import type { OrderStatus } from '@/modules/sales/order-states';
import { periods, type Range, type SalesRow, type SalesTotals, totals } from './summary';

// Sales figures (R8, M3.3 T4): read-only aggregations over `orders` (and their `payments`), no collection of its own.
// A sale counts on its slot day (`slot.date`, a Luxembourg calendar day), the day the order list filters by, so the
// figures for a range equal that list's totals (AC-M3.3-06). Fully refunded orders have status `refunded` and drop
// out; partial refunds are deducted. Built early for the dashboard's key figures; T4 adds the group-by.

/** The statuses that make a sale. */
export const SOLD = ['confirmed', 'ready', 'out_for_delivery', 'completed'] as const satisfies readonly OrderStatus[];

/** Totals of the orders sold over a range of Luxembourg days (inclusive). */
export async function salesSummary(payload: Payload, { from, to }: Range): Promise<SalesTotals> {
  const rows = await model(payload, 'orders').aggregate<SalesRow>([
    { $match: { 'slot.date': { $gte: from, $lte: to }, status: { $in: [...SOLD] } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        totalCents: { $sum: '$totals.totalCents' },
        vatCents: { $sum: '$totals.vatCents' },
        refunds: { $push: { refundedCents: { $ifNull: ['$payment.refundedCents', 0] }, vatCents: '$totals.vatCents', totalCents: '$totals.totalCents' } },
      },
    },
    { $set: { refunds: { $filter: { input: '$refunds', cond: { $gt: ['$$this.refundedCents', 0] } } } } },
  ]);
  return totals(rows);
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

/** The orders sold whose money is not (all) in yet, and what they still owe: the order list's "awaiting payment" view. */
export const UNPAID = ['pending', 'partial'] as const;

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
