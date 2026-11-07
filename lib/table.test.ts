import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readTable, toCsv } from './table';

const csv = (text: string | Uint8Array) => readTable(Buffer.from(text), 'file.csv');

describe('readTable', () => {
  it('xlsx: numbers keep their written form (EAN, leading 0, decimals) and a blank row keeps the numbering', async () => {
    const table = await readTable(await readFile('tests/fixtures/table.xlsx'), 'Produits.XLSX');
    expect(table.headers).toEqual(['Libellé', 'Codes barre', 'Prix']);
    expect(table.rows).toEqual([
      { Libellé: 'Esses de Limão', 'Codes barre': '5603095885597', Prix: '3.95' },
      { Libellé: 'Pão Anadia', 'Codes barre': '0095865800476', Prix: '9.8' },
      { Libellé: '', 'Codes barre': '', Prix: '' },
      { Libellé: 'Pão Anadia', 'Codes barre': '', Prix: '0.9' },
    ]);
  });

  it.each([
    ['semicolons and a decimal comma', 'sku;price_eur\nA;14,50\n', [{ sku: 'A', price_eur: '14,50' }]],
    ['commas, quoted field with a comma and a line break', 'sku,name_fr\nA,"Vin, ""rouge""\nDouro"\n', [{ sku: 'A', name_fr: 'Vin, "rouge"\nDouro' }]],
    ['UTF-8 BOM, CRLF, trailing blank lines dropped', '﻿sku;price_eur\r\nA;1\r\n\r\n\r\n', [{ sku: 'A', price_eur: '1' }]],
    ['blank line inside kept (row numbers stay true), cells trimmed', 'sku;price_eur\n A ;1\n\nB;2\n', [{ sku: 'A', price_eur: '1' }, { sku: '', price_eur: '' }, { sku: 'B', price_eur: '2' }]],
    ['missing cells → empty text', 'sku;barcode;price_eur\nA\n', [{ sku: 'A', barcode: '', price_eur: '' }]],
  ])('csv: %s', async (_, text, rows) => {
    expect((await csv(text)).rows).toEqual(rows);
  });

  it('csv: Windows-1252 (French Excel) is decoded', async () => {
    const table = await csv(new Uint8Array([...Buffer.from('name_fr;x\nP'), 0xe3, ...Buffer.from('o Anadia;1\n')]));
    expect(table.rows[0].name_fr).toBe('Pão Anadia');
  });

  it('refuses other files', async () => {
    await expect(readTable(Buffer.from('x'), 'file.xls')).rejects.toThrow('the file must be .xlsx or .csv');
    await expect(readTable(Buffer.from('not a zip'), 'file.xlsx')).rejects.toThrow('unreadable .xlsx file');
  });
});

describe('toCsv', () => {
  it('writes a BOM, semicolons, CRLF and quotes what needs it; reads back the same', async () => {
    const out = toCsv(['sku', 'name_fr', 'price_eur'], [['A', 'Vin; "rouge"', '14,50'], ['B', null, undefined]]);
    expect(out).toBe('﻿sku;name_fr;price_eur\r\nA;"Vin; ""rouge""";14,50\r\nB;;\r\n');
    expect((await csv(out)).rows).toEqual([{ sku: 'A', name_fr: 'Vin; "rouge"', price_eur: '14,50' }, { sku: 'B', name_fr: '', price_eur: '' }]);
  });
});
