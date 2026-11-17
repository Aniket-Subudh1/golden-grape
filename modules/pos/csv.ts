import { parseDecimal } from '@/lib/money';
import { headerKey, type Table } from '@/lib/table';

// The till's daily sales file (M3.3 T5, CashMag export, A-10): pure parsing of a sheet already read by `readTable`
// (delimiter, BOM, quotes, encoding). The columns are named in Settings (`pos.csvMapping`), compared loosely.

export type CsvMapping = { receipt: string; date: string; time: string; barcode: string; ref: string; qty: string; unitPrice: string };

/** A-10: the columns of CashMag's daily sales export as documented, until a real sample (DEP-11) says otherwise. */
export const DEFAULT_MAPPING: CsvMapping = {
  receipt: 'Ticket',
  date: 'Date',
  time: 'Heure',
  barcode: 'Code barre',
  ref: 'Référence',
  qty: 'Quantité',
  unitPrice: 'Prix unitaire TTC',
};

/** One sold line: `line` is the spreadsheet row (header = 1). */
export type SaleRow = { line: number; receipt: string; date: string; time: string; barcode: string | null; ref: string | null; qty: number; unitPriceCents: number };
export type RowError = { line: number; reason: 'columns' | 'receipt' | 'date' | 'qty' | 'price' | 'code' };

const pad = (n: number) => String(n).padStart(2, '0');
const validDay = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

/** "17/11/2026", "17.11.2026", "2026-11-17", each with an optional " 14:05[:30]" → day and time. */
function dateTime(value: string, timeValue: string): { date: string; time: string } | null {
  const fr = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(value);
  const [y, m, d, h, min] = fr ? [fr[3], fr[2], fr[1], fr[4], fr[5]] : iso ? [iso[1], iso[2], iso[3], iso[4], iso[5]] : [];
  if (!y || !validDay(Number(y), Number(m), Number(d))) return null;
  const t = h ? [h, min] : /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(timeValue)?.slice(1) ?? ['12', '00'];
  if (Number(t[0]) > 23 || Number(t[1]) > 59) return null;
  return { date: `${y}-${pad(Number(m))}-${pad(Number(d))}`, time: `${pad(Number(t[0]))}:${t[1]}` };
}

/** "13,50", "13.50", "1 234,50", "1.234,50", "1,234.50", "€ 13,50" → cents; NaN otherwise. */
export function priceCents(value: string) {
  const s = value.replace(/[\s€]/g, '');
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  const normal = lastSep < 0 ? s : `${s.slice(0, lastSep).replace(/[.,]/g, '')}.${s.slice(lastSep + 1)}`;
  return parseDecimal(normal);
}

/** The rows of a sales file, and every row that cannot be read with why. Missing columns: one error, no rows. */
export function parseSalesCsv(table: Table, mapping: CsvMapping = DEFAULT_MAPPING): { rows: SaleRow[]; errors: RowError[]; missing: string[] } {
  const column = (name: string) => (name ? table.headers.find((h) => headerKey(h) === headerKey(name)) : undefined);
  const col = { receipt: column(mapping.receipt), date: column(mapping.date), time: column(mapping.time), barcode: column(mapping.barcode), ref: column(mapping.ref), qty: column(mapping.qty), unitPrice: column(mapping.unitPrice) };
  const missing = (['receipt', 'date', 'qty', 'unitPrice'] as const).filter((k) => !col[k]).map((k) => mapping[k]);
  if (!col.barcode && !col.ref) missing.push(`${mapping.barcode} / ${mapping.ref}`);
  if (missing.length) return { rows: [], errors: [{ line: 1, reason: 'columns' }], missing };

  const rows: SaleRow[] = [];
  const errors: RowError[] = [];
  const overflow = new Set(table.overflow ?? []);
  table.rows.forEach((r, i) => {
    const line = i + 2;
    const get = (c: string | undefined) => (c ? (r[c] ?? '').trim() : '');
    if (Object.values(r).every((v) => !v.trim())) return;
    if (overflow.has(line)) return void errors.push({ line, reason: 'columns' });
    const receipt = get(col.receipt);
    if (!receipt) return void errors.push({ line, reason: 'receipt' });
    const when = dateTime(get(col.date), get(col.time));
    if (!when) return void errors.push({ line, reason: 'date' });
    const qty = Number(get(col.qty).replace(',', '.'));
    if (!Number.isInteger(qty) || qty <= 0) return void errors.push({ line, reason: 'qty' });
    const unitPriceCents = priceCents(get(col.unitPrice));
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) return void errors.push({ line, reason: 'price' });
    const barcode = get(col.barcode) || null;
    const ref = get(col.ref) || null;
    if (!barcode && !ref) return void errors.push({ line, reason: 'code' });
    rows.push({ line, receipt, ...when, barcode, ref, qty, unitPriceCents });
  });
  return { rows, errors, missing: [] };
}
