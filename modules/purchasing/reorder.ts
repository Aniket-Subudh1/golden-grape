// The reorder suggestion (M3.1 T4), pure: what to buy for a size that reached its alert level, and from whom.

/**
 * `threshold × 2 − onHand` bottles, rounded up to whole supplier units (a box of 6 → boxes). A size on the list is low,
 * so at least one unit is always suggested (a level of 0 with nothing left would otherwise suggest nothing).
 */
export function suggestUnits(threshold: number, onHand: number, factor = 1): number {
  if (!Number.isInteger(factor) || factor < 1) throw new Error('factor');
  const bottles = Math.max(threshold * 2 - onHand, 1);
  return Math.ceil(bottles / factor);
}

export type Offer = { id: string; costCents: number; factor: number };

/** The cheapest offer per bottle (a box's cost ÷ its factor); on a tie, the first one listed. */
export function cheapest<T extends Offer>(offers: T[]): T | null {
  let best: T | null = null;
  for (const offer of offers) if (!best || offer.costCents / offer.factor < best.costCents / best.factor) best = offer;
  return best;
}

/** The latest purchase cost of one bottle, from a line's cost per supplier unit (half-up, integer cents). */
export const costPerBottle = (costCents: number, factor: number) => Math.round(costCents / factor);
