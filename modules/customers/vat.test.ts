import { describe, expect, it } from 'vitest';
import { isVatNumber, normalizeVat } from './vat';

describe('isVatNumber', () => {
  it.each([
    ['LU12345678', true],
    ['LU 1234 5678', true],
    ['lu12345678', true],
    ['FR40303265045', true],
    ['DE123456789', true],
    ['BE0123456789', true],
    ['PT123456789', true],
    ['NL123456789B01', true],
    ['LU1234567', false],
    ['LU123456789', false],
    ['XX12345678', false],
    ['12345678', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isVatNumber(value)).toBe(expected);
  });

  it('normalizes spaces, dots and dashes', () => {
    expect(normalizeVat('lu 12.34-56 78')).toBe('LU12345678');
  });
});
