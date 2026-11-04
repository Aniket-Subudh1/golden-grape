import { describe, expect, it } from 'vitest';
import { type QuoteCatalogue, quote, type QuoteRules } from './pricing';

const rules: QuoteRules = { vatRates: { standard: 1700, intermediate: 1400, reduced: 800, superReduced: 300 } };
const catalogue: QuoteCatalogue = {
  variants: {
    wine: { priceCents: 1999, vatClass: 'standard', product: 'p1' },
    cheese: { priceCents: 1800, vatClass: 'superReduced', product: 'p2' },
    douro: { priceCents: 3200, vatClass: 'intermediate', product: 'p3' },
  },
  units: {
    box6: { variant: 'douro', factor: 6, priceCents: 18000 },
    box12: { variant: 'douro', factor: 12 },
  },
};
const run = (lines: { variant: string; unit?: string; qty: number }[]) => quote({ lines, channel: 'webshop', now: new Date(), catalogue, rules });

describe('quote v1', () => {
  it('3 × 19.99 at 17 % → total 59.97, VAT 8.71', () => {
    const q = run([{ variant: 'wine', qty: 3 }]);
    expect(q.totalCents).toBe(5997);
    expect(q.vatCents).toBe(871);
    expect(q.vatBreakdown).toEqual([{ rateBp: 1700, baseCents: 5126, vatCents: 871 }]);
    expect(q.amountDueCents).toBe(5997);
  });

  it('mixed 17 % and 3 % lines → two breakdown rows whose VAT adds up to the total VAT', () => {
    const q = run([
      { variant: 'wine', qty: 2 },
      { variant: 'cheese', qty: 1 },
    ]);
    expect(q.vatBreakdown.map((v) => v.rateBp)).toEqual([1700, 300]);
    expect(q.vatBreakdown.reduce((sum, v) => sum + v.vatCents, 0)).toBe(q.vatCents);
    expect(q.vatBreakdown.reduce((sum, v) => sum + v.baseCents + v.vatCents, 0)).toBe(q.totalCents);
    expect(q.vatBreakdown[1]).toEqual({ rateBp: 300, baseCents: 1748, vatCents: 52 });
  });

  it('a box of 6 at its own price beats 6 × the bottle price', () => {
    const q = run([{ variant: 'douro', unit: 'box6', qty: 1 }]);
    expect(q.lines[0]).toMatchObject({ unitPriceCents: 18000, baseQty: 6, totalCents: 18000 });
    expect(q.totalCents).toBeLessThan(6 * 3200);
  });

  it('a box without its own price costs factor × the bottle price', () => {
    expect(run([{ variant: 'douro', unit: 'box12', qty: 2 }]).lines[0]).toMatchObject({ unitPriceCents: 38400, baseQty: 24, totalCents: 76800 });
  });

  it.each([
    ['an unknown variant', [{ variant: 'nope', qty: 1 }]],
    ['a unit of another variant', [{ variant: 'wine', unit: 'box6', qty: 1 }]],
    ['a zero quantity', [{ variant: 'wine', qty: 0 }]],
    ['a fractional quantity', [{ variant: 'wine', qty: 1.5 }]],
  ])('throws on %s', (_, lines) => {
    expect(() => run(lines)).toThrow();
  });

  it('an empty cart costs nothing', () => {
    expect(run([])).toMatchObject({ totalCents: 0, vatCents: 0, vatBreakdown: [], amountDueCents: 0 });
  });
});
