// One-off for APPLUX's QA report of 14 Nov 2026 (GG-26, GG-24); safe to run again. `--check` only reports.
// 1. Numbers issued before the French formats of 9 Nov still read REQ-, ORD-, QUO-: each is written again in its series'
//    current format with the same year and counter value (REQ-2026-0001 → DEM-2026-0001). That value was taken from
//    the counter when it was issued, so the series stays gapless and the next number does not change. The activity
//    log's copies of the old text follow (`ref`, `reason`). A number already taken is reported and left alone.
// 2. The Events list has a new default column ("Passé / à venir"): saved column choices of that list are cleared.
// Run: npm run migrate:2026-11-14 -- --check
import { getPayload } from 'payload';
import { formatNumber } from '@/lib/numbering';
import { model } from '@/lib/tx';
import { NUMBERING } from '@/modules/settings/globals';

// The formats before 9 Nov (scripts/migrate-2026-11.mts) of the series that have documents.
const SERIES = [
  { slug: 'cateringRequests', key: 'cateringRequest', old: 'REQ' },
  { slug: 'orders', key: 'order', old: 'ORD' },
  { slug: 'quotations', key: 'quotation', old: 'QUO' },
] as const;

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });

const settings = await payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true });
const renamed: [string, string][] = [];
let skipped = 0;
for (const { slug, key, old } of SERIES) {
  const format = settings.numbering?.[key] || NUMBERING[key];
  const docs = model(payload, slug);
  for (const d of await docs.find({ number: { $regex: `^${old}-\\d{4}-\\d+$` } }, { number: 1, title: 1 }).lean<{ _id: unknown; number: string; title?: string }[]>()) {
    const [, year, n] = d.number.split('-');
    const to = formatNumber(format, Number(year), Number(n));
    if (to.startsWith(`${old}-`)) continue; // a format someone chose to keep
    if (await docs.exists({ number: to })) {
      console.warn(`[number] ${slug} ${d.number}: ${to} already exists, left alone`);
      skipped++;
      continue;
    }
    console.info(`[number] ${slug} ${d.number} → ${to}`);
    // A quotation's title carries its number ("DEV-2026-0001 · Name").
    if (!check) await docs.updateOne({ _id: d._id }, { $set: { number: to, ...(d.title?.includes(d.number) ? { title: d.title.replace(d.number, to) } : {}) } });
    renamed.push([d.number, to]);
  }
}

const audit = model(payload, 'auditLogs');
let entries = 0;
for (const [from, to] of renamed) {
  for (const field of ['ref', 'reason'] as const) {
    const n = check ? await audit.countDocuments({ [field]: from }) : (await audit.updateMany({ [field]: from }, { $set: { [field]: to } })).modifiedCount;
    entries += n;
  }
}

const preferences = payload.db.connection.collection('payload-preferences');
const columns = { key: 'collection-events', 'value.columns': { $exists: true } };
const cleared = check ? await preferences.countDocuments(columns) : (await preferences.updateMany(columns, { $unset: { 'value.columns': '' } })).modifiedCount;

const verb = check ? 'to change (check only)' : 'changed';
console.info(`[migrate] ${renamed.length} number(s), ${entries} activity entr${entries === 1 ? 'y' : 'ies'}, ${cleared} saved Events column choice(s) ${verb}; ${skipped} left alone`);
await payload.destroy();
process.exit(0);
