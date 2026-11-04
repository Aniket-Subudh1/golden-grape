// Recomputes every stock level from the movement ledger (02 §5.1). `--check` only reports and exits 1 when a cached
// level differs from Σ movements; without it, the differing levels are rewritten from the ledger.
// Run: npm run rebuild-stock -- --check
import { getPayload } from 'payload';
import { rebuildStock } from '@/modules/inventory/service';

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
const differences = await rebuildStock(payload, { fix: !check });
for (const d of differences) console.info(`[stock] variant ${d.variant}: cache ${d.cache ?? 'none'}, ledger ${d.ledger}`);
console.info(`[stock] ${differences.length} difference(s)${differences.length && !check ? ' fixed' : ''}`);
await payload.destroy();
process.exit(check && differences.length ? 1 : 0);
