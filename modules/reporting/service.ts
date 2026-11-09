import type { Payload } from 'payload';
import { today } from '@/lib/time';
import { model } from '@/lib/tx';
import type { OrderStatus } from '@/modules/sales/order-states';
import { periods, type Range, type SalesRow, type SalesTotals, totals } from './summary';

// Sales figures (R8, M3.3 T4): read-only aggregations over `orders`, no collection of its own.
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

/** Today against yesterday, this month so far against the same days of last month. */
export async function salesOverview(payload: Payload, now = new Date()) {
  const p = periods(today(now));
  const [day, yesterday, month, lastMonth] = await Promise.all([p.today, p.yesterday, p.month, p.lastMonth].map((range) => salesSummary(payload, range)));
  return { periods: p, today: day, yesterday, month, lastMonth };
}
