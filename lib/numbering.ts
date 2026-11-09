import type { Tx } from './tx';

// Gapless per (series, year): the increment runs in the caller's transaction, so if the document insert
// fails the number is rolled back with it (02 §5.3). The only writer of `counters`.
export async function nextNumber(tx: Tx, series: string, year: number): Promise<number> {
  const counter = await tx
    .model('counters')
    .collection.findOneAndUpdate(
      { series, year },
      { $inc: { last: 1 } },
      { upsert: true, returnDocument: 'after', session: tx.session },
    );
  if (!counter) throw new Error(`nextNumber: no counter for ${series}/${year}`);
  return counter.last as number;
}

/** `formatNumber('FAC-{YYYY}-{00000}', 2026, 42)` → `FAC-2026-00042`. */
export const formatNumber = (format: string, year: number, n: number) =>
  format.replace('{YYYY}', String(year)).replace(/\{(0+)\}/, (_, zeros: string) => String(n).padStart(zeros.length, '0'));
