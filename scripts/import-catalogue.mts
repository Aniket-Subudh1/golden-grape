// Imports the client's catalogue spreadsheet (exported as CSV, columns as docs/templates/catalogue-template.csv).
// Idempotent by sku. Every row is checked first: with one invalid row, nothing is written and the row numbers and
// reasons are printed. Writes `<file>.log` next to the CSV, and the supplier columns to `<file>.suppliers.json`
// until the purchasing module (M3.1) has a collection for them.
// Run: npm run import:catalogue -- path/to/catalogue.csv
import { readFile, writeFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { importCatalogue, parseCatalogueCsv, validateCatalogue } from '@/modules/catalogue/import';
import { indexesReady } from '@/lib/tx';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:catalogue -- path/to/catalogue.csv');
  process.exit(2);
}

const lines: string[] = [];
const log = (message: string) => {
  lines.push(message);
  console.info(message);
};

const parsed = parseCatalogueCsv(await readFile(file, 'utf8'));
// Dynamic import: payload.config.ts compiles as CommonJS (see scripts/seed.mts).
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

// Format and database checks are reported together, so one run lists every problem in the file.
const errors = [...parsed.errors, ...(await validateCatalogue(payload, parsed.rows))];
const result = errors.length ? { errors, created: 0, updated: 0 } : await importCatalogue(payload, parsed.rows);
const stamp = new Date().toISOString();
if (result.errors.length) {
  log(`[import] ${stamp} ${file}: ${result.errors.length} error(s), nothing was written`);
  for (const e of result.errors.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column))) log(`  row ${e.row} · ${e.column}: ${e.message}`);
} else {
  log(`[import] ${stamp} ${file}: ${parsed.rows.length} rows, ${result.created} created, ${result.updated} updated`);
  const suppliers = parsed.rows.filter((r) => r.supplier).map((r) => ({ sku: r.sku, supplier: r.supplier, supplierRef: r.supplier_ref, costCents: r.cost_eur }));
  if (suppliers.length) {
    await writeFile(`${file}.suppliers.json`, `${JSON.stringify(suppliers, null, 2)}\n`);
    log(`[import] ${suppliers.length} supplier references kept in ${file}.suppliers.json for M3.1`);
  }
}
await writeFile(`${file}.log`, `${lines.join('\n')}\n`, { flag: 'a' });
await payload.destroy();
process.exit(result.errors.length ? 1 : 0);
