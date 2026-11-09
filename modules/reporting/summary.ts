import { add, divRound } from '@/lib/money';
import { addDays } from '@/lib/time';

// Pure side of the sales figures (M3.3 T4): the aggregation's rows folded into totals, and the date ranges the
// dashboard compares. Integer cents only; a range is inclusive Luxembourg calendar days (`YYYY-MM-DD`).

/** An order's partial refund, with the order's own totals so its VAT share can be taken back. */
export type Refund = { refundedCents: number; vatCents: number; totalCents: number };
/** One group of the aggregation: sums over its sold orders, and the refunded ones listed. */
export type SalesRow = { orders: number; totalCents: number; vatCents: number; refunds: Refund[] };
export type SalesTotals = { orders: number; grossCents: number; vatCents: number; netCents: number; refundedCents: number; averageCents: number };
export type Range = { from: string; to: string };

/**
 * Totals of 0..n rows. Gross includes VAT and has refunds deducted; a refund takes back its order's VAT share
 * (pro rata, rounded per order, A-14) until credit notes carry their own VAT (M3.2). Average basket is 0 with no orders.
 */
export function totals(rows: SalesRow[]): SalesTotals {
  const refunds = rows.flatMap((r) => r.refunds);
  const refundedCents = add(...refunds.map((r) => r.refundedCents));
  const refundVatCents = add(...refunds.map((r) => (r.totalCents > 0 ? divRound(r.refundedCents * r.vatCents, r.totalCents) : 0)));
  const orders = add(...rows.map((r) => r.orders));
  const grossCents = add(...rows.map((r) => r.totalCents)) - refundedCents;
  const vatCents = add(...rows.map((r) => r.vatCents)) - refundVatCents;
  return { orders, grossCents, vatCents, netCents: grossCents - vatCents, refundedCents, averageCents: orders ? divRound(grossCents, orders) : 0 };
}

/** Today, yesterday, this month so far, and the same days of last month (cut at its last day). */
export function periods(day: string): { today: Range; yesterday: Range; month: Range; lastMonth: Range } {
  const [y, m, d] = day.split('-').map(Number);
  const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const prefix = `${py}-${String(pm).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const yesterday = addDays(day, -1);
  return {
    today: { from: day, to: day },
    yesterday: { from: yesterday, to: yesterday },
    month: { from: `${day.slice(0, 7)}-01`, to: day },
    lastMonth: { from: `${prefix}-01`, to: `${prefix}-${String(Math.min(d, lastDay)).padStart(2, '0')}` },
  };
}
