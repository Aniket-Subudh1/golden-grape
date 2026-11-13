// One-off for APPLUX's QA report of 12 Nov 2026 (GG-07, GG-05); safe to run again. `--check` only reports.
// The Orders and Table reservations lists have new default columns (payment, attendance) and no longer offer the
// technical ones. Payload keeps each user's own column choice in their list preferences, which would hide the new
// defaults: that choice is cleared for these two lists, so everyone gets the new columns (and can change them again).
// Run: npm run migrate:2026-11-13 -- --check
import { getPayload } from 'payload';

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
const preferences = payload.db.connection.collection('payload-preferences');

const where = { key: { $in: ['collection-orders', 'collection-reservations'] }, 'value.columns': { $exists: true } };
for await (const p of preferences.find<{ key: string; user?: { value?: unknown } }>(where)) console.info(`[preferences] ${p.key} of user ${String(p.user?.value ?? '?')}: saved columns ${check ? "to clear" : "cleared"}`);
const { modifiedCount } = check ? { modifiedCount: await preferences.countDocuments(where) } : await preferences.updateMany(where, { $unset: { 'value.columns': '' } });

console.info(`[migrate] ${modifiedCount} saved column choice(s)${check ? ' to clear (check only)' : ' cleared'}`);
await payload.destroy();
process.exit(0);
