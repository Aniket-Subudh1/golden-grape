import { describe, expect, it } from 'vitest';
import { periods, type SalesRow, totals } from './summary';

const row = (over: Partial<SalesRow> = {}): SalesRow => ({ orders: 0, totalCents: 0, vatCents: 0, refunds: [], ...over });

describe('totals', () => {
  it('no orders: every figure is 0, the average basket too', () => {
    expect(totals([])).toEqual({ orders: 0, grossCents: 0, vatCents: 0, netCents: 0, refundedCents: 0, averageCents: 0 });
    expect(totals([row()])).toMatchObject({ orders: 0, averageCents: 0 });
  });

  it('gross includes VAT, net = gross − VAT, average basket rounded to the cent', () => {
    expect(totals([row({ orders: 3, totalCents: 10000, vatCents: 1453 })])).toEqual({
      orders: 3,
      grossCents: 10000,
      vatCents: 1453,
      netCents: 8547,
      refundedCents: 0,
      averageCents: 3333,
    });
  });

  it('the average basket rounds half up', () => {
    expect(totals([row({ orders: 2, totalCents: 1001 })]).averageCents).toBe(501);
  });

  it('a refund comes off gross and takes back its order’s VAT share', () => {
    const t = totals([row({ orders: 3, totalCents: 10000, vatCents: 1453, refunds: [{ refundedCents: 1170, vatCents: 170, totalCents: 1170 }] })]);
    expect(t).toEqual({ orders: 3, grossCents: 8830, vatCents: 1283, netCents: 7547, refundedCents: 1170, averageCents: 2943 });
  });

  it('a partial refund takes back VAT pro rata, rounded per order', () => {
    // 1000 of an 11 700 order holding 1 700 VAT → 145.30 → 145; 1 of 2 holding 1 → 0.5 → 1.
    const t = totals([
      row({
        orders: 2,
        totalCents: 11702,
        vatCents: 1701,
        refunds: [
          { refundedCents: 1000, vatCents: 1700, totalCents: 11700 },
          { refundedCents: 1, vatCents: 1, totalCents: 2 },
        ],
      }),
    ]);
    expect(t).toMatchObject({ grossCents: 10701, vatCents: 1555, netCents: 9146, refundedCents: 1001 });
  });

  it('rows fold into one total (the same totals whatever the grouping)', () => {
    const a = row({ orders: 1, totalCents: 5000, vatCents: 727 });
    const b = row({ orders: 2, totalCents: 3000, vatCents: 436, refunds: [{ refundedCents: 500, vatCents: 73, totalCents: 1000 }] });
    const together = row({ orders: 3, totalCents: 8000, vatCents: 1163, refunds: b.refunds });
    expect(totals([a, b])).toEqual(totals([together]));
    expect(totals([a, b])).toMatchObject({ orders: 3, grossCents: 7500, vatCents: 1126 });
  });
});

describe('periods', () => {
  it.each([
    ['2026-11-09', '2026-11-08', '2026-11-01', { from: '2026-10-01', to: '2026-10-09' }],
    ['2026-11-01', '2026-10-31', '2026-11-01', { from: '2026-10-01', to: '2026-10-01' }],
    ['2026-03-31', '2026-03-30', '2026-03-01', { from: '2026-02-01', to: '2026-02-28' }],
    ['2028-03-31', '2028-03-30', '2028-03-01', { from: '2028-02-01', to: '2028-02-29' }],
    ['2026-01-15', '2026-01-14', '2026-01-01', { from: '2025-12-01', to: '2025-12-15' }],
    ['2026-05-31', '2026-05-30', '2026-05-01', { from: '2026-04-01', to: '2026-04-30' }],
  ])('%s: yesterday %s, month from %s, last month %o', (day, yesterday, monthStart, lastMonth) => {
    expect(periods(day)).toEqual({
      today: { from: day, to: day },
      yesterday: { from: yesterday, to: yesterday },
      month: { from: monthStart, to: day },
      lastMonth,
    });
  });
});
