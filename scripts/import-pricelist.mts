// Imports a B2B price list from a spreadsheet (.csv or .xlsx; columns sku, unit_factor, price_eur). The list is
// found or created by name and its lines replaced, so running the same file twice changes nothing. Net prices unless
// --incl-vat. With one invalid row nothing is written; the rows and reasons are printed.
// Run: npm run import:pricelist -- path/to/list.csv "Restaurant Lisboa" [--incl-vat] [--dry-run]
import { readFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { readTable } from '@/lib/table';
import { indexesReady } from '@/lib/tx';
import { importPriceList, parsePriceList } from '@/modules/promotions/import';

const [file, name] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!file || !name) {
  console.error('Usage: npm run import:pricelist -- path/to/list.csv "List name" [--incl-vat] [--dry-run]');
  process.exit(2);
}
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

const parsed = parsePriceList(await readTable(await readFile(file), file));
const result = parsed.errors.length
  ? { errors: parsed.errors, written: 0 }
  : await importPriceList(payload, name, parsed.rows, {
      inclVat: process.argv.includes('--incl-vat'),
      dryRun: process.argv.includes('--dry-run'),
    });
for (const e of result.errors) console.error(`  line ${e.line}: ${e.reason}`);
console.info(
  result.errors.length
    ? `[pricelist] nothing written: ${result.errors.length} error(s)`
    : `[pricelist] "${name}": ${parsed.rows.length} price(s) ${process.argv.includes('--dry-run') ? 'checked' : 'written'}`,
);
await payload.destroy();
process.exit(result.errors.length ? 1 : 0);
