import { describe, expect, it } from 'vitest';
import { add, formatMoney, mulQty, netToGross, pct, vatFromGross } from './money';

describe('money', () => {
  it.each([
    ['mulQty(1999, 3)', mulQty(1999, 3), 5997],
    ['add(1999, 1, 0)', add(1999, 1, 0), 2000],
    ['vatFromGross(1170, 1700)', vatFromGross(1170, 1700), 170],
    ['vatFromGross(1000, 300)', vatFromGross(1000, 300), 29],
    ['vatFromGross(0, 1700)', vatFromGross(0, 1700), 0],
    ['pct(1, 5000) half-up', pct(1, 5000), 1],
    ['pct(3, 5000) half-up', pct(3, 5000), 2],
    ['pct(1005, 1000)', pct(1005, 1000), 101],
    ['pct(-1, 5000) half away from zero', pct(-1, 5000), -1],
    ['pct(1004, 1000) rounds down', pct(1004, 1000), 100],
    ['netToGross(1000, 1700)', netToGross(1000, 1700), 1170],
  ])('%s', (_, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('compact format drops ,00 on whole euros only', () => {
    expect(formatMoney(2800, 'fr', { compact: true })).toBe('28\u00a0€');
    expect(formatMoney(2850, 'fr', { compact: true })).toBe('28,50\u00a0€');
  });

  it('formats French euros with a narrow no-break space group and a no-break space before €', () => {
    expect(formatMoney(123456, 'fr')).toBe('1 234,56 €');
  });
});
