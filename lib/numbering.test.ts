import { describe, expect, it } from 'vitest';
import { formatNumber } from './numbering';

describe('formatNumber', () => {
  it.each([
    ['INV-{YYYY}-{00000}', 2026, 42, 'INV-2026-00042'],
    ['REQ-{YYYY}-{0000}', 2026, 1, 'REQ-2026-0001'],
    ['REQ-{YYYY}-{0000}', 2027, 12345, 'REQ-2027-12345'],
    ['CN{00}', 2026, 7, 'CN07'],
  ])('%s, %i, %i → %s', (format, year, n, expected) => {
    expect(formatNumber(format, year, n)).toBe(expected);
  });
});
