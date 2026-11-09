import { describe, expect, it } from 'vitest';
import { formatNumber } from './numbering';

describe('formatNumber', () => {
  it.each([
    ['FAC-{YYYY}-{00000}', 2026, 42, 'FAC-2026-00042'],
    ['DEM-{YYYY}-{0000}', 2026, 1, 'DEM-2026-0001'],
    ['DEM-{YYYY}-{0000}', 2027, 12345, 'DEM-2027-12345'],
    ['AV{00}', 2026, 7, 'AV07'],
  ])('%s, %i, %i → %s', (format, year, n, expected) => {
    expect(formatNumber(format, year, n)).toBe(expected);
  });
});
