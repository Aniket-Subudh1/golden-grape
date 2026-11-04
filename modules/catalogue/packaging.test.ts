import { describe, expect, it } from 'vitest';
import { normalizeLines, toBaseQty, validateFactor } from './packaging';

describe('toBaseQty', () => {
  it.each([
    ['box6 × 2', 2, 6, 12],
    ['box12 × 1', 1, 12, 12],
    ['base × 5', 5, 1, 5],
    ['box6 × −1 (return)', -1, 6, -6],
    ['zero', 0, 6, 0],
  ])('%s → %i', (_, unitQty, factor, expected) => {
    expect(toBaseQty(unitQty, factor)).toBe(expected);
  });

  it.each([
    ['a fractional quantity', 1.5, 6],
    ['factor 0', 1, 0],
    ['a negative factor', 1, -6],
    ['a fractional factor', 1, 2.5],
  ])('throws on %s', (_, unitQty, factor) => {
    expect(() => toBaseQty(unitQty, factor)).toThrow();
  });
});

describe('validateFactor (packaging units)', () => {
  it.each([
    [1, 'factorMin2'],
    [0, 'factorMin2'],
    [-6, 'factorMin2'],
    [2.5, 'factorMin2'],
    [null, 'factorMin2'],
    [2, true],
    [6, true],
    [12, true],
  ])('factor %s → %s', (factor, expected) => {
    expect(validateFactor(factor)).toBe(expected);
  });
});

describe('normalizeLines', () => {
  it('merges a box of 6 and two bottles of the same variant into 8', () => {
    expect(
      normalizeLines([
        { variant: 'v1', unitQty: 1, factor: 6 },
        { variant: 'v1', unitQty: 2, factor: 1 },
      ]),
    ).toEqual({ v1: 8 });
  });

  it('keeps variants apart and sums signed quantities', () => {
    expect(
      normalizeLines([
        { variant: 'v1', unitQty: -1, factor: 12 },
        { variant: 'v2', unitQty: 3, factor: 1 },
        { variant: 'v1', unitQty: 2, factor: 6 },
      ]),
    ).toEqual({ v1: 0, v2: 3 });
  });

  it('throws when any line is not a whole number', () => {
    expect(() => normalizeLines([{ variant: 'v1', unitQty: 0.5, factor: 6 }])).toThrow();
  });
});
