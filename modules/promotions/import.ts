import type { Payload } from 'payload';
import { parseDecimal } from '@/lib/money';
import { headerKey, type Table } from '@/lib/table';

// Price lists from a spreadsheet (M3.2 T1, for lists over 30 lines): columns `sku`, `unit_factor` (1 or empty = the
// bottle, 6 = the box of 6…), `price_eur` ("12,50" or "12.50"). Every row is checked first; with one bad row nothing is
// written. Importing the same file again replaces the list's lines: it is idempotent by list name.

export type PriceRow = { line: number; sku: string; factor: number; priceCents: number };
export type RowError = { line: number; reason: string };

/** Reads the table into rows (line numbers as in the spreadsheet, header = line 1) and the format errors. */
export function parsePriceList(table: Table): { rows: PriceRow[]; errors: RowError[] } {
  const col = (want: string) => table.headers.find((h) => headerKey(h) === headerKey(want));
  const [sku, factor, price] = [col('sku'), col('unit_factor'), col('price_eur')];
  if (!sku || !price) return { rows: [], errors: [{ line: 1, reason: 'columns sku and price_eur are required' }] };
  const rows: PriceRow[] = [];
  const errors: RowError[] = [];
  table.rows.forEach((raw, i) => {
    const line = i + 2;
    if (table.overflow?.includes(line))
      return void errors.push({
        line,
        reason:
          'more cells than columns: a decimal comma in a comma-separated file? Write 13.50, quote "13,50", or separate the columns with ;',
      });
    const code = (raw[sku] ?? '').trim();
    if (!code) return;
    const f = factor && raw[factor]?.trim() ? Number(raw[factor].trim()) : 1;
    const cents = parseDecimal((raw[price] ?? '').trim());
    if (!Number.isInteger(f) || f < 1)
      errors.push({ line, reason: `unit_factor "${raw[factor!]}" is not a whole number ≥ 1` });
    else if (!Number.isInteger(cents) || cents < 0)
      errors.push({ line, reason: `price_eur "${raw[price]}" is not an amount` });
    else rows.push({ line, sku: code, factor: f, priceCents: cents });
  });
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.sku}:${r.factor}`;
    if (seen.has(key)) errors.push({ line: r.line, reason: `${r.sku} × ${r.factor} already on line ${seen.get(key)}` });
    else seen.set(key, r.line);
  }
  return { rows, errors };
}

/**
 * Writes the rows into the list called `name` (created if missing, else its lines replaced), net prices unless
 * `inclVat`. Sizes are found by sku, boxes by their factor; an unknown sku or box is an error and nothing is written.
 */
export async function importPriceList(
  payload: Payload,
  name: string,
  rows: PriceRow[],
  { inclVat = false, dryRun = false } = {},
) {
  const { docs: variants } = await payload.find({
    collection: 'variants',
    where: { sku: { in: [...new Set(rows.map((r) => r.sku))] } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });
  const bySku = new Map(variants.map((v) => [v.sku, v.id]));
  const { docs: units } = await payload.find({
    collection: 'packagingUnits',
    where: { variant: { in: variants.map((v) => v.id) } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });
  const errors: RowError[] = [];
  const lines: { variant: string; unit?: string; priceCents: number }[] = [];
  for (const r of rows) {
    const variant = bySku.get(r.sku);
    if (!variant) {
      errors.push({ line: r.line, reason: `sku ${r.sku} not found` });
      continue;
    }
    const unit = r.factor > 1 ? units.find((u) => String(u.variant) === variant && u.factor === r.factor) : undefined;
    if (r.factor > 1 && !unit) {
      errors.push({ line: r.line, reason: `${r.sku} has no box of ${r.factor}` });
      continue;
    }
    lines.push({ variant, unit: unit?.id, priceCents: r.priceCents });
  }
  if (errors.length > 0 || dryRun) return { errors, written: 0, id: null as string | null };
  const { docs } = await payload.find({
    collection: 'priceLists',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });
  const doc = docs[0]
    ? await payload.update({
        collection: 'priceLists',
        id: docs[0].id,
        data: { lines, pricesInclVat: inclVat },
        overrideAccess: true,
        depth: 0,
      })
    : await payload.create({
        collection: 'priceLists',
        data: { name, lines, pricesInclVat: inclVat },
        overrideAccess: true,
        depth: 0,
      });
  return { errors, written: lines.length, id: doc.id };
}
