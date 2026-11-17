import { describe, expect, it } from 'vitest';
import { cheapest, costPerBottle, suggestUnits } from './reorder';

describe('suggestUnits: threshold × 2 − onHand, rounded up to the supplier unit', () => {
  it.each([
    // threshold, onHand, factor, units
    [3, 2, 1, 4],
    [3, 3, 1, 3],
    [5, 0, 6, 2], // 10 bottles → 2 boxes of 6
    [6, 0, 6, 2], // 12 bottles → exactly 2 boxes
    [6, 1, 6, 2], // 11 → 2
    [6, 0, 12, 1],
    [0, 0, 1, 1], // low at a level of 0: still one
    [3, 6, 6, 1], // above twice the level (raised meanwhile): still one
    [3, -4, 6, 2], // negative stock after a till import: 10 → 2 boxes
  ])('level %i, on hand %i, factor %i → %i', (threshold, onHand, factor, units) => {
    expect(suggestUnits(threshold, onHand, factor)).toBe(units);
  });
  it('refuses a factor below 1', () => {
    expect(() => suggestUnits(3, 0, 0)).toThrow();
  });
});

describe('cheapest offer per bottle', () => {
  it('compares a box cost divided by its factor', () => {
    const offers = [
      { id: 'bottle', costCents: 1100, factor: 1 },
      { id: 'box6', costCents: 6000, factor: 6 }, // 1000 per bottle
      { id: 'box12', costCents: 12600, factor: 12 }, // 1050
    ];
    expect(cheapest(offers)?.id).toBe('box6');
  });
  it('keeps the first on a tie, null when none', () => {
    expect(cheapest([{ id: 'a', costCents: 600, factor: 6 }, { id: 'b', costCents: 100, factor: 1 }])?.id).toBe('a');
    expect(cheapest([])).toBeNull();
  });
});

describe('costPerBottle', () => {
  it.each([
    [12000, 12, 1000], // the M3.1 T7 vector: a box of 12 at 120.00 → 10.00 a bottle
    [1000, 6, 167], // 166.67 → 167
    [1003, 2, 502], // 501.5 → 502 (half up)
    [999, 1, 999],
  ])('%i ÷ %i → %i', (cost, factor, expected) => {
    expect(costPerBottle(cost, factor)).toBe(expected);
  });
});
