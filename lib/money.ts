// Integer cents only. Rates are basis points (1700 = 17.00 %). Rounding is half away from zero.

const divRound = (numerator: number, denominator: number) =>
  Math.sign(numerator) * Math.floor((Math.abs(numerator) * 2 + denominator) / (denominator * 2));

export const add = (...cents: number[]) => cents.reduce((sum, c) => sum + c, 0);

export const mulQty = (cents: number, qty: number) => cents * qty;

export const pct = (cents: number, bp: number) => divRound(cents * bp, 10_000);

export const vatFromGross = (grossCents: number, bp: number) => divRound(grossCents * bp, 10_000 + bp);

export const netToGross = (netCents: number, bp: number) => netCents + pct(netCents, bp);

export const formatMoney = (cents: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
