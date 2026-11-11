import { describe, expect, it } from 'vitest';
import { priceDocument, type QuoteCatalogue, quote, type QuoteRules } from './pricing';

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

describe('quote: delivery (step 4)', () => {
  const deliver = (lines: { variant: string; qty: number }[], delivery: QuoteRules['delivery']) =>
    quote({ lines, channel: 'webshop', now: new Date(), catalogue, rules: { ...rules, delivery } });

  it('adds the fee to the total, with standard VAT in the breakdown', () => {
    const q = deliver([{ variant: 'cheese', qty: 1 }], { feeCents: 500, freeFromCents: 8000 });
    expect(q).toMatchObject({ subtotalCents: 1800, deliveryCents: 500, totalCents: 2300, amountDueCents: 2300 });
    expect(q.vatBreakdown).toEqual([
      { rateBp: 1700, baseCents: 427, vatCents: 73 },
      { rateBp: 300, baseCents: 1748, vatCents: 52 },
    ]);
    expect(q.vatCents).toBe(125);
  });

  it('merges the fee into an existing standard-rate group', () => {
    const q = deliver([{ variant: 'wine', qty: 1 }], { feeCents: 500 });
    expect(q.vatBreakdown).toEqual([{ rateBp: 1700, baseCents: 2136, vatCents: 363 }]);
  });

  it('is free at the threshold, charged one cent below it', () => {
    expect(deliver([{ variant: 'wine', qty: 4 }], { feeCents: 500, freeFromCents: 7996 }).deliveryCents).toBe(0);
    expect(deliver([{ variant: 'wine', qty: 4 }], { feeCents: 500, freeFromCents: 7997 }).deliveryCents).toBe(500);
  });

  it('no delivery rule (pickup, table) or an empty cart → no fee', () => {
    expect(deliver([{ variant: 'wine', qty: 1 }], null).deliveryCents).toBe(0);
    expect(deliver([], { feeCents: 500 }).totalCents).toBe(0);
  });
});

describe('priceDocument (catering quotations: free lines, VAT included)', () => {
  const menu = { qty: 20, unitPriceCents: 2800, vatBp: 300 };
  const service = { qty: 1, unitPriceCents: 15000, vatBp: 1700 };

  it('one line: 20 guests × 28,00 € at 3 %', () => {
    expect(priceDocument([menu])).toEqual({
      lines: [{ totalCents: 56000, discountCents: 0 }],
      subtotalCents: 56000,
      discountCents: 0,
      vatCents: 1631,
      totalCents: 56000,
      vatBreakdown: [{ rateBp: 300, baseCents: 54369, vatCents: 1631 }],
    });
  });

  it('two rates: the breakdown per rate, highest first', () => {
    const doc = priceDocument([menu, service]);
    expect(doc.vatBreakdown).toEqual([
      { rateBp: 1700, baseCents: 12821, vatCents: 2179 },
      { rateBp: 300, baseCents: 54369, vatCents: 1631 },
    ]);
    expect(doc).toMatchObject({ subtotalCents: 71000, vatCents: 3810, totalCents: 71000 });
  });

  it('10 % off: shared in proportion, VAT taken on what is charged', () => {
    const doc = priceDocument([menu, service], { kind: 'percent', value: 1000 });
    expect(doc.lines).toEqual([
      { totalCents: 56000, discountCents: 5600 },
      { totalCents: 15000, discountCents: 1500 },
    ]);
    expect(doc).toMatchObject({ subtotalCents: 71000, discountCents: 7100, totalCents: 63900 });
    expect(doc.vatBreakdown).toEqual([
      { rateBp: 1700, baseCents: 11538, vatCents: 1962 },
      { rateBp: 300, baseCents: 48932, vatCents: 1468 },
    ]);
  });

  it('a fixed amount: the cent left over goes to the largest remainder, the shares add up', () => {
    const doc = priceDocument(
      [
        { qty: 1, unitPriceCents: 3333, vatBp: 300 },
        { qty: 1, unitPriceCents: 6667, vatBp: 1700 },
      ],
      { kind: 'amount', value: 1000 },
    );
    expect(doc.lines.map((l) => l.discountCents)).toEqual([333, 667]);
    expect(doc).toMatchObject({ discountCents: 1000, totalCents: 9000 });
  });

  it('quantities with decimals (2,5 hours), rounded half away from zero', () => {
    expect(priceDocument([{ qty: 2.5, unitPriceCents: 4000, vatBp: 1700 }]).totalCents).toBe(10000);
    expect(priceDocument([{ qty: 1.5, unitPriceCents: 333, vatBp: 1700 }]).totalCents).toBe(500);
  });

  it('refuses a discount above the subtotal, a negative price and a zero quantity; no line → zeros', () => {
    expect(() => priceDocument([menu], { kind: 'amount', value: 56001 })).toThrow('discount');
    expect(() => priceDocument([{ ...menu, unitPriceCents: -1 }])).toThrow();
    expect(() => priceDocument([{ ...menu, qty: 0 }])).toThrow();
    expect(priceDocument([])).toMatchObject({ subtotalCents: 0, totalCents: 0, vatCents: 0, vatBreakdown: [] });
  });
});
