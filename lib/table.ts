import Papa from 'papaparse';
import { readSheet } from 'read-excel-file/node';
import { AppError } from './errors';

// Spreadsheets in and out of the back office. Readers: the catalogue import, the stock count from a file, the POS
// product import. Writers: the catalogue and stock-movement exports.

/** A sheet as text. `rows[i]` is spreadsheet row `i + 2` (row 1 is the header), blank rows included. */
export type Table = { headers: string[]; rows: Record<string, string>[] };

const cell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();

/** Excel's "CSV" in French or German Windows is often Windows-1252, not UTF-8. */
function decode(data: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1252').decode(data);
  }
}

/** Reads the first sheet of an .xlsx, or a .csv (`,` or `;`, detected), as text: numbers keep their written form
 * (an EAN keeps its leading 0; "9.8" stays "9.8"). */
export async function readTable(data: Buffer, filename: string): Promise<Table> {
  let grid: string[][];
  if (/\.xlsx$/i.test(filename)) {
    try {
      grid = (await readSheet(data, { parseNumber: (s) => s })).map((row) => row.map(cell));
    } catch {
      throw new AppError('VALIDATION', 'unreadable .xlsx file');
    }
  } else if (/\.(csv|txt)$/i.test(filename)) {
    const text = decode(data).replace(/^﻿/, '');
    // The delimiter is the header line's most frequent of ; , tab (Papa's guess fails on short files with blank lines).
    const head = text.split(/\r?\n/, 1)[0];
    const delimiter = [';', '\t', ','].reduce((best, d) => (head.split(d).length > head.split(best).length ? d : best), ',');
    grid = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false }).data.map((row) => row.map(cell));
  } else {
    throw new AppError('VALIDATION', 'the file must be .xlsx or .csv');
  }
  const [head = [], ...body] = grid;
  while (body.length && (body.at(-1) ?? []).every((v) => !v)) body.pop();
  const headers = head.map((h) => h.trim());
  return { headers, rows: body.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))) };
}

/** A header compared loosely: no case, accents, spaces or punctuation ("Code-barre" = "code barre" = "codebarre"). */
export const headerKey = (header: string) => header.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** CSV that Excel opens correctly in Luxembourg: UTF-8 BOM (accents), `;` between cells, CRLF line ends. */
export const toCsv = (headers: string[], rows: (string | number | null | undefined)[][]) =>
  `﻿${Papa.unparse({ fields: headers, data: rows.map((r) => r.map((v) => v ?? '')) }, { delimiter: ';', newline: '\r\n' })}\r\n`;
