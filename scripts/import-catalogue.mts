// Imports a catalogue spreadsheet (.xlsx or .csv, columns as public/catalogue-template.csv; only the columns
// present are written). Upserts by sku, else barcode; new products are drafts. Every row is checked first: with one
// invalid row, nothing is written and the row numbers and reasons are printed. Writes `<file>.log` next to the file.
// The supplier columns go to purchasing (suppliers + a bottle price per size, M3.1). A `<file>.suppliers.json` kept by
// an import made before M3.1 is loaded with `--suppliers`.
// Run: npm run import:catalogue -- path/to/catalogue.xlsx [--dry-run]
//      npm run import:catalogue -- path/to/catalogue.xlsx.suppliers.json --suppliers
import { readFile, writeFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { readTable } from '@/lib/table';
import { indexesReady } from '@/lib/tx';
import { importCatalogue, parseCatalogue, previewCatalogue } from '@/modules/catalogue/import';
import { importSupplierRefs, type SupplierRef } from '@/modules/purchasing/service';

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

// Dynamic import: payload.config.ts compiles as CommonJS (see scripts/seed.mts).
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

const logSuppliers = (r: Awaited<ReturnType<typeof importSupplierRefs>>) => {
  log(`[suppliers] ${r.suppliers} supplier(s) created, ${r.created} price(s) created, ${r.updated} updated`);
  for (const s of r.skipped) log(`  ${s.code || '(no sku)'}: ${s.reason === 'unknown' ? 'size not found' : 'no cost_eur'}`);
};

if (process.argv.includes('--suppliers')) {
  logSuppliers(await importSupplierRefs(payload, JSON.parse(await readFile(file, 'utf8')) as SupplierRef[]));
  await writeFile(`${file}.log`, `${lines.join('\n')}\n`, { flag: 'a' });
  await payload.destroy();
  process.exit(0);
}

const parsed = parseCatalogue(await readTable(await readFile(file), file));

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
  const suppliers = parsed.rows.filter((r) => r.supplier).map((r) => ({ sku: r.sku, barcode: r.barcode, supplier: r.supplier as string, supplierRef: r.supplier_ref, costCents: r.cost_eur }));
  if (suppliers.length) logSuppliers(await importSupplierRefs(payload, suppliers));
}
await writeFile(`${file}.log`, `${lines.join('\n')}\n`, { flag: 'a' });
await payload.destroy();
process.exit(errors.length ? 1 : 0);
