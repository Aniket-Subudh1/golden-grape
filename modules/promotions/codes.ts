import { randomInt } from 'node:crypto';

// Gift card codes (04 §5): 16 characters from an alphabet without look-alikes (no 0/O, 1/I), drawn by the server.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const cardCode = () => Array.from({ length: 16 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** "ABCD-EFGH-JKMN-PQRS": how a code is printed and read out; typed codes are compared without the dashes. */
export const groupCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;
export const normalizeCode = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The same day `months` later (end of a shorter month when the day does not exist there). */
export function monthsAfter(from: Date, months: number) {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d;
}
