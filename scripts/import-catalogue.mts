// Imports a catalogue spreadsheet (.xlsx or .csv, columns as docs/templates/catalogue-template.csv; only the columns
// present are written). Upserts by sku, else barcode; new products are drafts. Every row is checked first: with one
// invalid row, nothing is written and the row numbers and reasons are printed. Writes `<file>.log` next to the file,
// and the supplier columns to `<file>.suppliers.json` until the purchasing module (M3.1) has a collection for them.
// Run: npm run import:catalogue -- path/to/catalogue.xlsx [--dry-run]
import { readFile, writeFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { readTable } from '@/lib/table';
import { indexesReady } from '@/lib/tx';
import { importCatalogue, parseCatalogue, previewCatalogue } from '@/modules/catalogue/import';

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) {
  console.error('Usage: npm run import:catalogue -- path/to/catalogue.xlsx [--dry-run]');
  process.exit(2);
}

const lines: string[] = [];
const log = (message: string) => {
  lines.push(message);
  console.info(message);
};

const parsed = parseCatalogue(await readTable(await readFile(file), file));
// Dynamic import: payload.config.ts compiles as CommonJS (see scripts/seed.mts).
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

// Format and database checks are reported together, so one run lists every problem in the file.
const preview = await previewCatalogue(payload, parsed.rows);
const errors = [...parsed.errors, ...preview.errors];
const stamp = new Date().toISOString();
if (errors.length) {
  log(`[import] ${stamp} ${file}: ${errors.length} error(s), nothing was written`);
  for (const e of errors.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column))) log(`  row ${e.row} · ${e.column}: ${e.message}`);
} else if (dryRun) {
  log(`[import] ${stamp} ${file}: ${parsed.rows.length} rows OK (dry run): ${preview.create} to create, ${preview.update} to update`);
} else {
  const result = await importCatalogue(payload, parsed.rows);
  log(`[import] ${stamp} ${file}: ${parsed.rows.length} rows, ${result.created} created, ${result.updated} updated`);
  const suppliers = parsed.rows.filter((r) => r.supplier).map((r) => ({ sku: r.sku, barcode: r.barcode, supplier: r.supplier, supplierRef: r.supplier_ref, costCents: r.cost_eur }));
  if (suppliers.length) {
    await writeFile(`${file}.suppliers.json`, `${JSON.stringify(suppliers, null, 2)}\n`);
    log(`[import] ${suppliers.length} supplier references kept in ${file}.suppliers.json for M3.1`);
  }
}
await writeFile(`${file}.log`, `${lines.join('\n')}\n`, { flag: 'a' });
await payload.destroy();
process.exit(errors.length ? 1 : 0);
