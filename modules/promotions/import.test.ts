import { describe, expect, it } from 'vitest';
import { parsePriceList } from './import';

// A price read wrong from the spreadsheet would be charged to a business customer: amounts, boxes and duplicates.
describe('parsePriceList', () => {
  const table = (rows: Record<string, string>[]) => ({ headers: ['SKU', 'Unit factor', 'Price (EUR)'], rows });

  it('reads comma and dot amounts in cents, an empty factor as the bottle', () => {
    const { rows, errors } = parsePriceList({
      headers: ['sku', 'unit_factor', 'price_eur'],
      rows: [
        { sku: 'GG-DOURO', unit_factor: '', price_eur: '12,50' },
        { sku: 'GG-DOURO', unit_factor: '6', price_eur: '54.00' },
      ],
    });
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, sku: 'GG-DOURO', factor: 1, priceCents: 1250 },
      { line: 3, sku: 'GG-DOURO', factor: 6, priceCents: 5400 },
    ]);
  });

  it('finds the columns whatever their case or punctuation', () => {
    expect(parsePriceList(table([{ SKU: 'A', 'Unit factor': '12', 'Price (EUR)': '100' }])).rows).toHaveLength(1);
  });

  it('reports a bad amount, a bad factor and a size listed twice, with spreadsheet line numbers', () => {
    const { errors } = parsePriceList({
      headers: ['sku', 'unit_factor', 'price_eur'],
      rows: [
        { sku: 'A', unit_factor: '1', price_eur: 'abc' },
        { sku: 'B', unit_factor: '0', price_eur: '5' },
        { sku: 'C', unit_factor: '6', price_eur: '5' },
        { sku: 'C', unit_factor: '6', price_eur: '6' },
      ],
    });
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5]);
  });

  it('refuses a row whose decimal comma split the price into two cells, instead of keeping the euros', () => {
    const { rows, errors } = parsePriceList({
      headers: ['sku', 'unit_factor', 'price_eur'],
      rows: [{ sku: 'A', unit_factor: '', price_eur: '13' }],
      overflow: [2],
    });
    expect(rows).toEqual([]);
    expect(errors[0]).toMatchObject({ line: 2, reason: expect.stringMatching(/decimal comma/) });
  });

  it('refuses a file without the price column', () => {
    expect(parsePriceList({ headers: ['sku'], rows: [] }).errors[0].reason).toMatch(/price_eur/);
  });
});
