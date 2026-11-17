// Imports business customers from a spreadsheet (DEP-08; .csv or .xlsx; columns company, vat, contact, email, phone,
// address "street, postcode town", group, price_list, payment_term in days). Idempotent by e-mail. Price lists are
// imported first (npm run import:pricelist). With one invalid row nothing is written.
// Run: npm run import:customers -- path/to/customers.csv [--dry-run]
import { readFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { readTable } from '@/lib/table';
import { indexesReady } from '@/lib/tx';
import { importCustomers, parseCustomers } from '@/modules/customers/import';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:customers -- path/to/customers.csv [--dry-run]');
  process.exit(2);
}
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

const parsed = parseCustomers(await readTable(await readFile(file), file));
const result = parsed.errors.length
  ? { errors: parsed.errors, created: 0, updated: 0 }
  : await importCustomers(payload, parsed.rows, { dryRun: process.argv.includes('--dry-run') });
for (const e of result.errors) console.error(`  line ${e.line}: ${e.reason}`);
console.info(
  result.errors.length
    ? `[customers] nothing written: ${result.errors.length} error(s)`
    : `[customers] ${result.created} created, ${result.updated} updated`,
);
await payload.destroy();
process.exit(result.errors.length ? 1 : 0);
