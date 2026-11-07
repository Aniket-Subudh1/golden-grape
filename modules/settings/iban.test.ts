import { describe, expect, it } from 'vitest';
import { formatIban, isBic, isIban } from './iban';

describe('isIban', () => {
  it.each(['LU12 0010 0012 3456 7891', 'lu120010001234567891', 'BE68 5390 0754 7034', 'NL91 ABNA 0417 1643 00'])('%s is valid', (iban) => expect(isIban(iban)).toBe(true));
  it.each([
    ['a wrong check digit', 'LU13 0010 0012 3456 7891'],
    ['a typo in the account', 'LU12 0010 0012 3456 7892'],
    ['too short', 'LU12 0010'],
    ['not an IBAN', 'to be confirmed'],
    ['the published Luxembourg example', 'LU28 0019 4006 4475 0000'],
    ['the published German example', 'DE89 3704 0044 0532 0130 00'],
  ])('%s is refused', (_, iban) => expect(isIban(iban)).toBe(false));
});

describe('isBic', () => {
  it.each(['BCEELULL', 'bgllLULL', 'CCRALULLXXX'])('%s is valid', (bic) => expect(isBic(bic)).toBe(true));
  it.each(['BCEE', 'BCEELU', '12EELULL', 'BCEELULLX'])('%s is refused', (bic) => expect(isBic(bic)).toBe(false));
});

it('formats an IBAN in groups of four', () => expect(formatIban('lu120010001234567891')).toBe('LU12 0010 0012 3456 7891'));
