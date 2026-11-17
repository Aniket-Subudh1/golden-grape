import { describe, expect, it } from 'vitest';
import {
  type DiscountCode,
  type PriceList,
  priceDocument,
  type Promotion,
  type QuoteCatalogue,
  type QuoteInput,
  quote,
  type QuoteRules,
} from './pricing';

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
const run = (lines: { variant: string; unit?: string; qty: number }[]) =>
  quote({ lines, channel: 'webshop', now: new Date(), catalogue, rules });

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
    expect(run([{ variant: 'douro', unit: 'box12', qty: 2 }]).lines[0]).toMatchObject({
      unitPriceCents: 38400,
      baseQty: 24,
      totalCents: 76800,
    });
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

// M3.2 T4: the vector table of the milestone, one row each (standard VAT 1700 bp, reduced 300 bp; gross cents).
const R: QuoteRules = { vatRates: { standard: 1700, intermediate: 1400, reduced: 800, superReduced: 300 } };
const C: QuoteCatalogue = {
  variants: {
    a: { priceCents: 2000, vatClass: 'standard', product: 'pa', category: 'red', brand: 'douro' },
    b: { priceCents: 1999, vatClass: 'standard', product: 'pb', category: 'red' },
    c: { priceCents: 2500, vatClass: 'standard', product: 'pc', category: 'port' },
    d: { priceCents: 3000, vatClass: 'standard', product: 'pd', category: 'red', brand: 'douro' },
    e: { priceCents: 1000, vatClass: 'superReduced', product: 'pe', category: 'cheese' },
    f: { priceCents: 1000, vatClass: 'standard', product: 'pf' },
    g: { priceCents: 1000, vatClass: 'standard', product: 'pg' },
    h: { priceCents: 1400, vatClass: 'standard', product: 'ph', category: 'red' },
  },
  units: { box6: { variant: 'h', factor: 6 } },
};
const NOW = new Date('2026-11-17T12:00:00Z');
const promo = (over: Partial<Promotion>): Promotion => ({
  id: 'p',
  type: 'percent',
  value: 1000,
  target: 'all',
  targets: [],
  channels: ['webshop', 'mobile'],
  active: true,
  ...over,
});
const code = (over: Partial<DiscountCode>): DiscountCode => ({
  code: 'TEN',
  type: 'percent',
  value: 1000,
  uses: 0,
  channels: ['webshop', 'mobile'],
  active: true,
  ...over,
});
const q = (lines: QuoteInput['lines'], over: Partial<QuoteInput> = {}, rules: Partial<QuoteRules> = {}) =>
  quote({ lines, channel: 'webshop', now: NOW, catalogue: C, ...over, rules: { ...R, ...rules } });
const list = (inclVat: boolean, lines: PriceList['lines']): PriceList => ({ id: 'L', inclVat, lines });

describe('quote: the M3.2 vectors', () => {
  it('#1 1 × 2000 @17 % → total 2000, VAT 291', () => {
    expect(q([{ variant: 'a', qty: 1 }])).toMatchObject({ totalCents: 2000, vatCents: 291 });
  });
  it('#2 3 × 1999 @17 % → total 5997, VAT 871', () => {
    expect(q([{ variant: 'b', qty: 3 }])).toMatchObject({ totalCents: 5997, vatCents: 871 });
  });
  it('#3 2 × 2500, promo 10 % on its category → line 4500, discount 500', () => {
    const r = q([{ variant: 'c', qty: 2 }], {}, { promotions: [promo({ target: 'categories', targets: ['port'] })] });
    expect(r.lines[0]).toMatchObject({ totalCents: 4500, promoCents: 500, promotion: 'p' });
    expect(r.promotionCents).toBe(500);
  });
  it('#4 1 × 3000, 10 % and fixed 500 both match → the best (fixed 500) alone → 2500', () => {
    const r = q(
      [{ variant: 'd', qty: 1 }],
      {},
      { promotions: [promo({ id: 'ten' }), promo({ id: 'five', type: 'fixed', value: 500 })] },
    );
    expect(r.lines[0]).toMatchObject({ totalCents: 2500, promotion: 'five' });
    expect(r.totalCents).toBe(2500);
  });
  it('#5 a promotion outside its dates → no discount', () => {
    const r = q(
      [{ variant: 'd', qty: 1 }],
      {},
      { promotions: [promo({ startsAt: '2026-12-01', endsAt: '2026-12-31' })] },
    );
    expect(r.totalCents).toBe(3000);
    expect(
      q([{ variant: 'd', qty: 1 }], {}, { promotions: [promo({ endsAt: '2026-11-16T23:59:59Z' })] }).totalCents,
    ).toBe(3000);
  });
  it('#6 promotion for the website only, sale on the phone → no discount', () => {
    expect(
      q([{ variant: 'd', qty: 1 }], { channel: 'mobile' }, { promotions: [promo({ channels: ['webshop'] })] })
        .totalCents,
    ).toBe(3000);
  });
  it('#7 code 10 % with a 50 € minimum on 49,99 € → rejected CODE_MIN_NOT_MET, total unchanged', () => {
    const r = q(
      [
        { variant: 'b', qty: 1 },
        { variant: 'd', qty: 1 },
      ],
      { code: 'TEN' },
      { code: code({ minOrderCents: 5000 }) },
    );
    expect(r.subtotalCents).toBe(4999);
    expect(r).toMatchObject({ codeRejected: 'CODE_MIN_NOT_MET', code: null, discountCents: 0, totalCents: 4999 });
  });
  it('#8 fixed code 1000 on a 600 subtotal → discount 600, total 0', () => {
    const r = q(
      [{ variant: 'x', qty: 1 }],
      {
        code: 'X',
        catalogue: { variants: { x: { priceCents: 600, vatClass: 'standard', product: 'px' } }, units: {} },
      },
      { code: code({ type: 'fixed', value: 1000 }) },
    );
    expect(r).toMatchObject({ discountCents: 600, totalCents: 0, vatCents: 0, amountDueCents: 0 });
  });
  it('#9 code 10 % on 3000 @17 % + 1000 @3 % → 300 / 100 off; VAT 392 (17 %) + 26 (3 %)', () => {
    const r = q(
      [
        { variant: 'd', qty: 1 },
        { variant: 'e', qty: 1 },
      ],
      { code: 'TEN' },
      { code: code({}) },
    );
    expect(r.lines.map((l) => l.discountCents)).toEqual([300, 100]);
    expect(r.vatBreakdown).toEqual([
      { rateBp: 1700, baseCents: 2308, vatCents: 392 },
      { rateBp: 300, baseCents: 874, vatCents: 26 },
    ]);
  });
  it('#10 fixed code 100 on 3 lines of 1000 → 34 / 33 / 33 (remainder to the largest line, the first on a tie)', () => {
    const r = q(
      [
        { variant: 'e', qty: 1 },
        { variant: 'f', qty: 1 },
        { variant: 'g', qty: 1 },
      ],
      { code: 'C' },
      { code: code({ type: 'fixed', value: 100 }) },
    );
    expect(r.lines.map((l) => l.discountCents)).toEqual([34, 33, 33]);
  });
  it('#11 delivery 500, 40 € after the code, free from 50 € → fee 500 at 17 %', () => {
    const r = q(
      [
        { variant: 'a', qty: 2 },
        { variant: 'f', qty: 1 },
      ],
      { code: 'C' },
      { code: code({ type: 'fixed', value: 1000 }), delivery: { feeCents: 500, freeFromCents: 5000 } },
    );
    expect(r.subtotalCents - r.discountCents).toBe(4000);
    expect(r.deliveryCents).toBe(500);
    expect(r.vatBreakdown).toEqual([{ rateBp: 1700, baseCents: 3846, vatCents: 654 }]);
    expect(r.totalCents).toBe(4500);
  });
  it('#12 delivery, subtotal 50 €, free from 50 € → fee 0', () => {
    expect(
      q(
        [
          { variant: 'a', qty: 2 },
          { variant: 'f', qty: 1 },
        ],
        {},
        { delivery: { feeCents: 500, freeFromCents: 5000 } },
      ).deliveryCents,
    ).toBe(0);
  });
  it('#13 B2B net list 1000 @17 % with a matching 10 % promotion → 1170 gross, promotion not applied (A-03)', () => {
    const r = q(
      [{ variant: 'a', qty: 1 }],
      {},
      { priceLists: { customer: list(false, [{ variant: 'a', priceCents: 1000 }]) }, promotions: [promo({})] },
    );
    expect(r.lines[0]).toMatchObject({ unitPriceCents: 1170, fromList: true, promoCents: 0, totalCents: 1170 });
  });
  it('#14 B2B net list price 5400 for the box of 6 @17 % → line 6318', () => {
    const r = q(
      [{ variant: 'h', unit: 'box6', qty: 1 }],
      {},
      { priceLists: { customer: list(false, [{ variant: 'h', unit: 'box6', priceCents: 5400 }]) } },
    );
    expect(r.lines[0]).toMatchObject({ totalCents: 6318, baseQty: 6 });
  });
  it('#15 loyalty: 200 points available, worth 5 each, total 800 → 160 points used, 800 applied, nothing due', () => {
    const r = q(
      [{ variant: 'x', qty: 1 }],
      {
        loyaltyPoints: 200,
        catalogue: { variants: { x: { priceCents: 800, vatClass: 'standard', product: 'px' } }, units: {} },
      },
      { loyalty: { pointValueCents: 5 } },
    );
    expect(r).toMatchObject({ loyaltyPointsUsed: 160, loyaltyCents: 800, amountDueCents: 0 });
  });
  it('#16 gift card 5000, total 3000 → 3000 applied, 2000 left on the card', () => {
    const r = q([{ variant: 'd', qty: 1 }], { giftCards: [{ code: 'G1', balanceCents: 5000 }] });
    expect(r.giftCards).toEqual([{ code: 'G1', amountCents: 3000 }]);
    expect(5000 - r.giftCards[0].amountCents).toBe(2000);
    expect(r.amountDueCents).toBe(0);
  });
  it('#17 gift cards 1000 then 5000, total 3000 → 1000 + 2000 applied, in that order', () => {
    const r = q([{ variant: 'd', qty: 1 }], {
      giftCards: [
        { code: 'G1', balanceCents: 1000 },
        { code: 'G2', balanceCents: 5000 },
      ],
    });
    expect(r.giftCards).toEqual([
      { code: 'G1', amountCents: 1000 },
      { code: 'G2', amountCents: 2000 },
    ]);
  });
  it('#18 an expired gift card → rejected GIFT_CARD_EXPIRED, nothing applied', () => {
    const r = q([{ variant: 'd', qty: 1 }], {
      giftCards: [{ code: 'OLD', balanceCents: 5000, expiresAt: '2026-11-01' }],
    });
    expect(r.giftCardsRejected).toEqual([{ code: 'OLD', reason: 'GIFT_CARD_EXPIRED' }]);
    expect(r.amountDueCents).toBe(3000);
  });
  it('#19 any combination → amount due ≥ 0 and Σ VAT breakdown = VAT total', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const n = (k: number) => ((seed * 9301 + k * 49297) % 233280) / 233280;
      const ids = ['a', 'b', 'c', 'd', 'e', 'h'];
      const lines = ids
        .filter((_, i) => n(i) > 0.4)
        .map((variant, i) => ({ variant, qty: 1 + Math.floor(n(i + 7) * 4) }));
      const r = q(
        lines,
        {
          code: n(20) > 0.5 ? 'C' : null,
          loyaltyPoints: Math.floor(n(21) * 500),
          giftCards: n(22) > 0.5 ? [{ code: 'G', balanceCents: Math.floor(n(23) * 9000) }] : [],
        },
        {
          promotions:
            n(24) > 0.5
              ? [
                  promo({ value: 500 + Math.floor(n(25) * 3000) }),
                  promo({ id: 'f', type: 'fixed', value: Math.floor(n(26) * 900) }),
                ]
              : [],
          code: code({
            type: n(27) > 0.5 ? 'fixed' : 'percent',
            value: n(27) > 0.5 ? Math.floor(n(28) * 20000) : 1 + Math.floor(n(28) * 9999),
          }),
          delivery: { feeCents: 500, freeFromCents: 5000 },
          loyalty: { pointValueCents: 5 },
          priceLists: n(29) > 0.7 ? { customer: list(false, [{ variant: 'a', priceCents: 1500 }]) } : undefined,
        },
      );
      expect(r.amountDueCents).toBeGreaterThanOrEqual(0);
      expect(r.vatBreakdown.reduce((s, v) => s + v.vatCents, 0)).toBe(r.vatCents);
      expect(r.vatBreakdown.reduce((s, v) => s + v.baseCents + v.vatCents, 0)).toBe(r.totalCents);
      expect(r.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(r.discountCents);
      expect(r.amountDueCents + r.loyaltyCents + r.giftCards.reduce((s, g) => s + g.amountCents, 0)).toBe(r.totalCents);
    }
  });
});

describe('quote: what a discount code checks', () => {
  const r = (c: Partial<DiscountCode>, over: Partial<QuoteInput> = {}) =>
    q([{ variant: 'd', qty: 2 }], { code: 'C', customer: { id: 'me' }, ...over }, { code: code(c) }).codeRejected;
  it.each([
    ['unknown', null, 'CODE_UNKNOWN'],
    ['switched off', { active: false }, 'CODE_INACTIVE'],
    ['not started', { startsAt: '2026-12-01' }, 'CODE_NOT_STARTED'],
    ['over', { endsAt: '2026-11-01' }, 'CODE_EXPIRED'],
    ['for the website only, on a phone sale', { channels: ['webshop'] as const }, 'CODE_CHANNEL'],
    ['for other customers', { customers: ['you'] }, 'CODE_NOT_FOR_YOU'],
    ['used up', { maxUses: 3, uses: 3 }, 'CODE_USED_UP'],
    ['already used by this customer', { maxUsesPerCustomer: 1, usesByCustomer: 1 }, 'CODE_ALREADY_USED'],
  ])('%s → %s', (_, c, reason) => {
    if (c === null) expect(q([{ variant: 'd', qty: 1 }], { code: 'C' }, { code: null }).codeRejected).toBe(reason);
    else expect(r(c as Partial<DiscountCode>, reason === 'CODE_CHANNEL' ? { channel: 'mobile' } : {})).toBe(reason);
  });
  it('a valid code for this customer applies', () => {
    expect(r({ customers: ['me'], maxUses: 3, uses: 2, maxUsesPerCustomer: 2, usesByCustomer: 1 })).toBeNull();
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
