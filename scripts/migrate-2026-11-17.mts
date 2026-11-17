// One-off for the M3.1–M3.3 release (17 Nov 2026); safe to run again. `--check` only reports.
// A customer's payment term was free text before M3.2 and is now a number of days ("0" on receipt, 8, 15, 30, 45, 60):
// a typed term ("30 jours", "Net 45") takes the nearest allowed value at or above the days it names, an empty or
// unreadable one "0". Without this, saving such a customer in the admin is refused (not one of the choices).
// Run: npm run migrate:2026-11-17 -- --check
import type { MongooseAdapter } from '@payloadcms/db-mongodb';
import { getPayload } from 'payload';
import { model } from '@/lib/tx';

const ALLOWED = [0, 8, 15, 30, 45, 60];
const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });

const customers = model(payload, 'customers');
const odd = await customers.find({ paymentTerm: { $exists: true, $nin: ALLOWED.map(String) } }, { paymentTerm: 1, name: 1, company: 1 }).lean<{ _id: unknown; paymentTerm: unknown; name?: string; company?: string }[]>();
for (const c of odd) {
  const days = Number.parseInt(String(c.paymentTerm ?? '').replace(/\D+/g, ' ').trim().split(' ')[0] ?? '', 10);
  const to = String(Number.isFinite(days) ? (ALLOWED.find((a) => a >= days) ?? 60) : 0);
  console.info(`[paymentTerm] ${c.company || c.name}: "${String(c.paymentTerm)}" → ${to}`);
  if (!check) await customers.updateOne({ _id: c._id }, { $set: { paymentTerm: to } });
}
console.info(`${check ? 'Would change' : 'Changed'} ${odd.length} customer(s).`);

// Client request 17 Nov: delivery is priced by driving distance. A delivery area of postcodes (no "up to km") no longer
// means anything; while no distance range exists, they are replaced by two starting ranges Golden Grape then edits.
const zones = model(payload, 'deliveryZones');
const ranges = await zones.countDocuments({ upToKm: { $gt: 0 } });
const old = await zones.find({ upToKm: { $exists: false } }, { name: 1 }).lean<{ _id: unknown; name?: string }[]>();
if (ranges === 0) {
  const start = [
    { upToKm: 10, name: '≤ 10 km', feeCents: 500, minOrderCents: 3000, freeFromCents: 8000 },
    { upToKm: 20, name: '≤ 20 km', feeCents: 800, minOrderCents: 5000, freeFromCents: 12000 },
  ];
  console.info(`[delivery] ${old.length} postcode area(s) (${old.map((z) => z.name).join(', ')}) → ranges ${start.map((r) => r.name).join(', ')}`);
  if (!check) {
    await zones.deleteMany({ upToKm: { $exists: false } });
    const now = new Date();
    await zones.insertMany(start.map((r) => ({ ...r, active: true, createdAt: now, updatedAt: now })));
  }
} else if (old.length > 0) {
  console.info(`[delivery] ${old.length} postcode area(s) left alone: distance ranges exist; delete them in the admin.`);
}

// Client request 17 Nov: "Traiteur" no longer appears anywhere on the site. The texts staff and the seed stored (menu,
// footer, pages, catering packages, photo descriptions) say "Services Catering" instead, most specific wording first.
const RULES: [RegExp, string][] = [
  [/\bservice traiteur\b/g, 'services catering'],
  [/\b([Dd])emandes? traiteur\b/g, '$1emande de catering'],
  [/\b([Dd])evis traiteur\b/g, '$1evis catering'],
  [/\b([Ff])ormules traiteur\b/g, '$1ormules de catering'],
  [/\b(Plateau|Longue table|grande table) traiteur\b/g, '$1 de réception'],
  [/\bTraiteur\b/g, 'Services Catering'],
  [/\btraiteur\b/g, 'services catering'],
];
const rewrite = (value: unknown): unknown => {
  if (typeof value === 'string') return RULES.reduce((text, [from, to]) => text.replace(from, to), value);
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object' && !(value instanceof Date) && value.constructor === Object) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
  return value;
};
const stores = [
  { name: 'globals', collection: (payload.db as unknown as MongooseAdapter).globals.collection },
  ...(['pages', 'media', 'cateringPackages'] as const).map((slug) => ({ name: slug, collection: model(payload, slug).collection })),
];
for (const { name, collection } of stores) {
  let changed = 0;
  for await (const doc of collection.find({})) {
    const { _id, ...rest } = doc;
    if (!JSON.stringify(rest).toLowerCase().includes('traiteur')) continue;
    const next = rewrite(rest) as Record<string, unknown>;
    changed++;
    console.info(`[traiteur] ${name} ${String(doc.globalType ?? doc.slug ?? doc.filename ?? _id)}`);
    if (!check) await collection.replaceOne({ _id }, next);
  }
  console.info(`[traiteur] ${name}: ${check ? 'would change' : 'changed'} ${changed} document(s).`);
}
process.exit(0);
