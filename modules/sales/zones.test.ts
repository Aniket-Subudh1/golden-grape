import { describe, expect, it } from 'vitest';
import table from './postcode-km.json';
import { deliveryFee, isDeliverable, isLuxPostalCode, normalizePostalCode, rangeForKm, resolveZone, sortedRanges, type DeliveryRange, type PostcodeTable } from './zones';

const near: DeliveryRange = { upToKm: 10, feeCents: 500, minOrderCents: 3000, freeFromCents: 8000, active: true };
const far: DeliveryRange = { upToKm: 20, feeCents: 800, minOrderCents: 5000, freeFromCents: null, active: true };
const off: DeliveryRange = { upToKm: 40, feeCents: 1500, minOrderCents: 8000, active: false };
// Entered in any order: the shortest one comes first.
const ranges = [far, off, near];
const km: PostcodeTable = { '7795': [0.7, 'Bissen'], '9010': [10, 'Ettelbruck'], '9011': [10.1, 'Ettelbruck'], '2449': [26.8, 'Luxembourg'] };

describe('normalizePostalCode', () => {
  it.each([
    ['L-7795', '7795'],
    ['l 7795', '7795'],
    [' 7795 ', '7795'],
    ['L7795', '7795'],
  ])('%s → %s', (input, expected) => expect(normalizePostalCode(input)).toBe(expected));

  it('a Luxembourg postcode is 4 digits', () => {
    expect(['7795', '779', '77950', 'abcd'].map(isLuxPostalCode)).toEqual([true, false, false, false]);
  });
});

describe('ranges', () => {
  it('sorted by limit, each starting where the previous one ends; switched-off ones left out', () => {
    expect(sortedRanges(ranges).map((r) => [r.fromKm, r.upToKm])).toEqual([
      [0, 10],
      [10, 20],
    ]);
  });

  it.each([
    [0, 10],
    [10, 10], // the limit belongs to its range
    [10.1, 20],
    [20, 20],
    [20.1, null], // beyond the longest: no delivery (the switched-off 40 km range is not used)
  ])('%s km → range up to %s km', (distance, expected) => expect(rangeForKm(distance, ranges)?.upToKm ?? null).toBe(expected));

  it('moving a limit moves the postcodes with it', () => {
    expect(resolveZone('9011', ranges, km)?.upToKm).toBe(20);
    expect(resolveZone('9011', [{ ...near, upToKm: 12 }, far], km)?.upToKm).toBe(12);
  });
});

describe('resolveZone', () => {
  it.each([
    ['near, with the prefix', 'L-7795', { upToKm: 10, km: 0.7, place: 'Bissen', feeCents: 500 }],
    ['on the limit', '9010', { upToKm: 10, km: 10 }],
    ['just past it', '9011', { upToKm: 20, fromKm: 10, feeCents: 800 }],
  ])('%s', (_, code, expected) => expect(resolveZone(code, ranges, km)).toMatchObject(expected));

  it.each([
    ['too far', '2449'],
    ['unknown postcode', '1009'],
    ['empty', ''],
  ])('%s → no delivery', (_, code) => expect(resolveZone(code, ranges, km)).toBeNull());

  it('no range at all → no delivery', () => expect(resolveZone('7795', [], km)).toBeNull());

  it('the shipped table knows every Luxembourg postcode, with the shop next door', () => {
    const shipped = table as unknown as PostcodeTable;
    expect(Object.keys(shipped).length).toBeGreaterThan(4000);
    expect(shipped['7795'][0]).toBeLessThan(2);
    expect(Object.keys(shipped).every(isLuxPostalCode)).toBe(true);
  });
});

describe('deliveryFee', () => {
  it.each([
    ['below the minimum', 2500, { feeCents: 500, belowMinimum: true }],
    ['at the minimum', 3000, { feeCents: 500, belowMinimum: false }],
    ['just below the free threshold', 7999, { feeCents: 500, belowMinimum: false }],
    ['at the free threshold', 8000, { feeCents: 0, belowMinimum: false }],
    ['above it', 12000, { feeCents: 0, belowMinimum: false }],
  ])('%s', (_, subtotal, expected) => expect(deliveryFee(near, subtotal)).toEqual(expected));

  it('a range without a free threshold always charges', () => {
    expect(deliveryFee(far, 50000).feeCents).toBe(800);
  });
});

describe('isDeliverable (client request 17 Nov)', () => {
  it.each([
    [{ kind: 'wine' }, true],
    [{ kind: 'grocery', pickupOnly: false }, true],
    [{ kind: 'gift', pickupOnly: null }, true],
    [{ kind: 'snack' }, false],
    [{ kind: 'snack', pickupOnly: false }, false], // a counter dish never travels, whatever the box says
    [{ kind: 'wine', pickupOnly: true }, false],
  ])('%j → %s', (product, expected) => expect(isDeliverable(product)).toBe(expected));
});
