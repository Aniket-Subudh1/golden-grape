// Integer cents only. Rates are basis points (1700 = 17.00 %). Rounding is half away from zero.

export const divRound = (numerator: number, denominator: number) =>
  Math.sign(numerator) * Math.floor((Math.abs(numerator) * 2 + denominator) / (denominator * 2));

export const add = (...cents: number[]) => cents.reduce((sum, c) => sum + c, 0);

export const mulQty = (cents: number, qty: number) => cents * qty;

export const pct = (cents: number, bp: number) => divRound(cents * bp, 10_000);

export const vatFromGross = (grossCents: number, bp: number) => divRound(grossCents * bp, 10_000 + bp);

export const netToGross = (netCents: number, bp: number) => netCents + pct(netCents, bp);

/** `compact` drops `,00` on whole euros (menu and price-list style); documents keep the full format. */
export const formatMoney = (cents: number, locale: string, { compact = false } = {}) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    ...(compact && cents % 100 === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(cents / 100);

/**
 * An amount typed by a person ("45", "45,5", "45.50 €", "17 %") → integer units × `scale` (cents for €, basis points
 * for %), rounded half away from zero on the next digit. `NaN` when it is empty or not a number.
 */
export function parseDecimal(input: string, scale = 100): number {
  const s = input.replace(/[\s€%]/g, '').replace(',', '.');
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && !m[3])) return NaN;
  const digits = Math.round(Math.log10(scale));
  const frac = `${m[3] ?? ''}${'0'.repeat(digits + 1)}`;
  const units = Number(m[2] || '0') * scale + Number(frac.slice(0, digits) || '0') + (Number(frac[digits]) >= 5 ? 1 : 0);
  return m[1] ? -units : units;
}
