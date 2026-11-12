// Bank details for transfer payments (GG-014). Pure. An IBAN is checked with its own check digits (ISO 13616,
// mod 97), so a typo or a made-up number cannot be saved; the published example IBANs are refused too, because
// customers would be told to pay into an account that is not the shop's.

const compact = (value: string) => value.replace(/[\s-]+/g, '').toUpperCase();

/** Example IBANs printed in standards and bank documentation (the admin used to show the Luxembourg one as a hint). */
const EXAMPLES = new Set(['LU280019400644750000', 'DE89370400440532013000', 'GB82WEST12345698765432', 'FR1420041010050500013M02606']);

export function isIban(value: string) {
  const iban = compact(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || EXAMPLES.has(iban)) return false;
  const digits = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** 8 or 11 characters: bank, country, place, optional branch ("BCEELULL"). */
export const isBic = (value: string) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(value));

/** "lu280019400644750000" → "LU28 0019 4006 4475 0000", the way customers type it into their bank. */
export const formatIban = (value: string) => compact(value).replace(/(.{4})(?=.)/g, '$1 ');

export type BankAccount = { id?: string | null; holder?: string | null; bankName?: string | null; iban?: string | null; bic?: string | null; active?: boolean | null; isDefault?: boolean | null };

/** The accounts customers may be asked to pay into: active, with an IBAN. */
export const activeAccounts = (accounts: BankAccount[] | null | undefined) => (accounts ?? []).filter((a) => a.active !== false && a.iban);

/** The account a new transfer order gets: the default one if it is active, else the first active one, else none. */
export const transferAccount = (accounts: BankAccount[] | null | undefined) => {
  const usable = activeAccounts(accounts);
  return usable.find((a) => a.isDefault) ?? usable[0] ?? null;
};

/** Exactly one default among the active accounts: the first one ticked, else the first active one. */
export function withOneDefault<T extends BankAccount>(accounts: T[]): T[] {
  const chosen = accounts.find((a) => a.isDefault && a.active !== false) ?? accounts.find((a) => a.active !== false);
  return accounts.map((a) => ({ ...a, isDefault: a === chosen }));
}
