// Loyalty points (M3.2 T3), pure: how many an order earns and which ones expire. The ledger (loyaltyLedger) is the
// record; `customers.loyaltyBalance` its cache, changed only by conditional updates in rewards.ts.

/** A line as earning sees it: what was charged for it, and whether its product earns points. */
export type EarnLine = { totalCents: number; discountCents: number; earns: boolean };

/**
 * Points for an order: floor(eligible / 100 × pointsPerEuro), where eligible = what was charged for the lines that
 * earn (not excluded, not gift cards), minus the value of the points used on the order, never below 0.
 */
export function earnedPoints(lines: EarnLine[], loyaltyCents: number, pointsPerEuro: number) {
  const eligible = lines.filter((l) => l.earns).reduce((sum, l) => sum + l.totalCents - l.discountCents, 0);
  return Math.floor((Math.max(0, eligible - loyaltyCents) * pointsPerEuro) / 100);
}

export type LedgerRow = { id: string; points: number; at: Date | string; expiresAt?: Date | string | null };

/**
 * The points to expire at `now`: positive rows are lots (an earn, a staff addition); every negative row (a redeem, an
 * expiry, a staff removal) uses the oldest lots first (FIFO). A lot past its `expiresAt` with points left expires
 * those points; a lot without `expiresAt` never expires. Rows in any order.
 */
export function expirable(rows: LedgerRow[], now: Date) {
  const sorted = [...rows].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const lots = sorted
    .filter((r) => r.points > 0)
    .map((r) => ({ id: r.id, left: r.points, expiresAt: r.expiresAt ? new Date(r.expiresAt) : null }));
  let used = -sorted.filter((r) => r.points < 0).reduce((sum, r) => sum + r.points, 0);
  for (const lot of lots) {
    const take = Math.min(lot.left, used);
    lot.left -= take;
    used -= take;
  }
  return lots
    .filter((l) => l.left > 0 && l.expiresAt !== null && l.expiresAt.getTime() <= now.getTime())
    .map((l) => ({ lot: l.id, points: l.left }));
}
