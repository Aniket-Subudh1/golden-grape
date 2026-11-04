// Packaging units (R12): a box of 6 is the variant's base unit × 6. Pure: no Payload import.

/** Field validation for `packagingUnits.factor`: a whole number of base units, at least 2 (1 is the variant itself). */
export const validateFactor = (factor: unknown): true | string =>
  Number.isInteger(factor) && (factor as number) >= 2 ? true : 'factorMin2';

/** `unitQty` packaging units in base units. Signed (a return or an adjustment can be negative). */
export function toBaseQty(unitQty: number, factor: number): number {
  if (!Number.isInteger(unitQty)) throw new Error(`toBaseQty: quantity ${unitQty} is not a whole number`);
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`toBaseQty: factor ${factor} must be a whole number ≥ 1`);
  return unitQty * factor;
}

/** Merges lines by variant into one signed base quantity each: `[{v1, box6 × 1}, {v1, base × 2}]` → `{ v1: 8 }`. */
export function normalizeLines(lines: { variant: string; unitQty: number; factor: number }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of lines) totals[line.variant] = (totals[line.variant] ?? 0) + toBaseQty(line.unitQty, line.factor);
  return totals;
}
