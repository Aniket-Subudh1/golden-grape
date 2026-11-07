import { describe, expect, it } from 'vitest';
import { deliveryFee, isLuxPostalCode, normalizePostalCode, resolveZone, splitPostalCodes, type Zone } from './zones';

const bissen: Zone = { name: 'Bissen', postalCodes: ['7795', 'L-7790'], feeCents: 500, minOrderCents: 3000, freeFromCents: 8000, active: true };
const closed: Zone = { name: 'Ettelbruck', postalCodes: ['9010'], feeCents: 800, minOrderCents: 4000, active: false };
const zones = [bissen, closed];

describe('normalizePostalCode', () => {
  it.each([
    ['L-7795', '7795'],
    ['l 7795', '7795'],
    [' 7795 ', '7795'],
    ['L7795', '7795'],
  ])('%s → %s', (input, expected) => expect(normalizePostalCode(input)).toBe(expected));
});

describe('resolveZone', () => {
  it.each([
    ['inside', '7795', 'Bissen'],
    ['inside, written with the prefix', 'L-7790', 'Bissen'],
    ['zone listed with a prefix, typed without', '7790', 'Bissen'],
    ['outside every zone', '1009', null],
    ['an inactive zone is ignored', '9010', null],
    ['empty', '', null],
  ])('%s', (_, code, expected) => expect(resolveZone(code, zones)?.name ?? null).toBe(expected));
});

describe('deliveryFee', () => {
  it.each([
    ['below the minimum', 2500, { feeCents: 500, belowMinimum: true }],
    ['at the minimum', 3000, { feeCents: 500, belowMinimum: false }],
    ['just below the free threshold', 7999, { feeCents: 500, belowMinimum: false }],
    ['at the free threshold', 8000, { feeCents: 0, belowMinimum: false }],
    ['above it', 12000, { feeCents: 0, belowMinimum: false }],
  ])('%s', (_, subtotal, expected) => expect(deliveryFee(bissen, subtotal)).toEqual(expected));

  it('a zone without a free threshold always charges', () => {
    expect(deliveryFee({ ...bissen, freeFromCents: null }, 50000).feeCents).toBe(500);
  });
});

describe('splitPostalCodes (GG-036)', () => {
  it.each([
    [['7760, 7770, 7780'], ['7760', '7770', '7780']],
    [['7760 7770\n7780;7790'], ['7760', '7770', '7780', '7790']],
    [['L-7795, l 7760,L7770'], ['7795', '7760', '7770']],
    [['7795', '7760, 7795'], ['7795', '7760']],
    [[' , ,'], []],
  ])('%j → %j', (input, expected) => expect(splitPostalCodes(input)).toEqual(expected));

  it('a Luxembourg postcode is 4 digits', () => {
    expect(['7795', '779', '77950', 'abcd'].map(isLuxPostalCode)).toEqual([true, false, false, false]);
  });
});
