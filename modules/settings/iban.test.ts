import { describe, expect, it } from 'vitest';
import { activeAccounts, formatIban, isBic, isIban, transferAccount, withOneDefault } from './iban';

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

describe('bank accounts (APPLUX, 12 Nov: several accounts, one default)', () => {
  const a = { id: 'a', iban: 'LU12 0010 0012 3456 7891', active: true, isDefault: false };
  const b = { id: 'b', iban: 'BE68 5390 0754 7034', active: true, isDefault: true };
  const off = { id: 'c', iban: 'NL91 ABNA 0417 1643 00', active: false, isDefault: true };
  it('a transfer uses the default account', () => expect(transferAccount([a, b])?.id).toBe('b'));
  it('a deactivated default is never used: the first active one is', () => expect(transferAccount([off, a])?.id).toBe('a'));
  it('no active account → none', () => expect(transferAccount([off])).toBeNull());
  it('an account without an IBAN is not offered', () => expect(activeAccounts([{ id: 'x', active: true }, a]).map((x) => x.id)).toEqual(['a']));
  it('keeps one default: the first ticked active one', () => expect(withOneDefault([a, { ...b }, { ...a, id: 'd', isDefault: true }]).map((x) => x.isDefault)).toEqual([false, true, false]));
  it('no default ticked, or only on a deactivated account → the first active one', () => expect(withOneDefault([off, a, { ...b, isDefault: false }]).map((x) => x.isDefault)).toEqual([false, true, false]));
});
