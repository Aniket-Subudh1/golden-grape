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

// Client request 17 Nov: the home page's banners are tall on computers and the contact section has a photo. A slot that
// is empty or still holds the photo the seed first put there takes the new choice (uploaded from public/brand if it is
// not in the media library yet); a photo staff picked stays.
const HOME: Record<string, { file: string; was: string[]; alt: string }> = {
  shop: { file: 'home-store/Home_2.jpg', was: [], alt: 'Bouteilles de vins portugais alignées devant les étagères de la boutique' },
  table: { file: 'snack-menu/Snack_3.jpg', was: ['Home_8.jpg'], alt: 'Sandwich chaud aux frites allumettes, servi avec un verre de vin rouge' },
  catering: { file: 'catering-events/Catering_4.jpg', was: ['Catering_9.jpg'], alt: 'Table de réception couverte de fruits, macarons et douceurs devant le mur de vins' },
  events: { file: 'owners-team/Owners_2.jpg', was: ['Home_11.jpg'], alt: 'Une soirée musicale à la Maison, verre de vin à la main' },
  contact: { file: 'home-store/Home_9.jpg', was: [], alt: 'Le salon de la boutique au soleil, devant les étagères de vins' },
};
const home = await payload.findGlobal({ slug: 'HomePage', depth: 1, overrideAccess: true });
const photos: Record<string, unknown> = { ...(home.photos ?? {}) };
let moved = 0;
for (const [slot, { file, was, alt }] of Object.entries(HOME)) {
  const current = photos[slot] as { filename?: string } | string | null | undefined;
  const name = typeof current === 'object' && current ? current.filename : undefined;
  // Payload adds "-1" to a name already taken (Home_8-1.jpg).
  if (current && !(name && was.includes(name.replace(/-\d+(\.\w+)$/, '$1')))) continue;
  const filename = file.split('/').pop()!;
  console.info(`[home] ${slot}: ${name ?? 'empty'} → ${filename}`);
  moved++;
  if (check) continue;
  const found = await payload.find({ collection: 'media', where: { filename: { equals: filename } }, limit: 1, depth: 0, overrideAccess: true });
  const doc = found.docs[0] ?? (await payload.create({ collection: 'media', data: { alt }, filePath: `public/brand/${file}`, locale: 'fr', overrideAccess: true }));
  photos[slot] = doc.id;
}
if (moved > 0 && !check) {
  const ids = Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, typeof v === 'object' && v ? (v as { id: string }).id : v]));
  // Outside Next the cache tag cannot be cleared here: the deploy's fresh build shows the new photos.
  await payload.updateGlobal({ slug: 'HomePage', data: { photos: ids } as never, depth: 0, overrideAccess: true, context: { skipRevalidate: true } });
}
console.info(`[home] ${check ? 'would set' : 'set'} ${moved} photo(s).`);
process.exit(0);
