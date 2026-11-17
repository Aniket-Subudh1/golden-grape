import { describe, expect, it } from 'vitest';
import { formatNumber } from './numbering';

describe('formatNumber', () => {
  it.each([
    ['FAC-{YYYY}-{00000}', 2026, 42, 'FAC-2026-00042'],
    // M3.2 T6: the vector named in the milestone, and the credit note and delivery note series.
    ['FAC-{YYYY}-{00000}', 2026, 7, 'FAC-2026-00007'],
    ['AV-{YYYY}-{00000}', 2026, 1, 'AV-2026-00001'],
    ['BL-{YYYY}-{00000}', 2027, 3, 'BL-2027-00003'],
    ['DEM-{YYYY}-{0000}', 2026, 1, 'DEM-2026-0001'],
    ['DEM-{YYYY}-{0000}', 2027, 12345, 'DEM-2027-12345'],
    ['AV{00}', 2026, 7, 'AV07'],
  ])('%s, %i, %i → %s', (format, year, n, expected) => {
    expect(formatNumber(format, year, n)).toBe(expected);
  });
});
