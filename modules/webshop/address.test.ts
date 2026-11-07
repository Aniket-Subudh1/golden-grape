import { describe, expect, it } from 'vitest';
import { localitiesOf, parseAddressLabel } from './address';

describe('parseAddressLabel', () => {
  it.each([
    ['36, Route de Roost, L-7791 Bissen', { line1: '36, Route de Roost', postalCode: '7791', city: 'Bissen' }],
    ['2A, Rue de la Gare, L-1611 Luxembourg', { line1: '2A, Rue de la Gare', postalCode: '1611', city: 'Luxembourg' }],
    ['1, Am Duerf, L-9999 Wemperhaardt', { line1: '1, Am Duerf', postalCode: '9999', city: 'Wemperhaardt' }],
  ])('%s', (label, expected) => expect(parseAddressLabel(label)).toEqual(expected));

  it('anything else is not an address', () => {
    expect(parseAddressLabel('Bissen')).toBeNull();
    expect(parseAddressLabel('Route de Roost, 7791 Bissen')).toBeNull();
  });
});

describe('localitiesOf', () => {
  it('keeps the localities of that postcode, once each', () => {
    const r = [
      { AddressDetails: { zip: '7795', locality: 'Bissen' } },
      { AddressDetails: { zip: '7795', locality: 'Bissen' } },
      { AddressDetails: { zip: '7790', locality: 'Bissen' } },
      { AddressDetails: null },
    ];
    expect(localitiesOf(r, '7795')).toEqual(['Bissen']);
    expect(localitiesOf(r, '1234')).toEqual([]);
  });
});
