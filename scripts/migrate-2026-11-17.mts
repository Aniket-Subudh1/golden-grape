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
const odd = await customers
  .find({ paymentTerm: { $exists: true, $nin: ALLOWED.map(String) } }, { paymentTerm: 1, name: 1, company: 1 })
  .lean<{ _id: unknown; paymentTerm: unknown; name?: string; company?: string }[]>();
for (const c of odd) {
  const days = Number.parseInt(
    String(c.paymentTerm ?? '')
      .replace(/\D+/g, ' ')
      .trim()
      .split(' ')[0] ?? '',
    10,
  );
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
  console.info(
    `[delivery] ${old.length} postcode area(s) (${old.map((z) => z.name).join(', ')}) → ranges ${start.map((r) => r.name).join(', ')}`,
  );
  if (!check) {
    await zones.deleteMany({ upToKm: { $exists: false } });
    const now = new Date();
    await zones.insertMany(start.map((r) => ({ ...r, active: true, createdAt: now, updatedAt: now })));
  }
} else if (old.length > 0) {
  console.info(
    `[delivery] ${old.length} postcode area(s) left alone: distance ranges exist; delete them in the admin.`,
  );
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
  if (value && typeof value === 'object' && !(value instanceof Date) && value.constructor === Object)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
  return value;
};
const stores = [
  { name: 'globals', collection: (payload.db as unknown as MongooseAdapter).globals.collection },
  ...(['pages', 'media', 'cateringPackages'] as const).map((slug) => ({
    name: slug,
    collection: model(payload, slug).collection,
  })),
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
  shop: {
    file: 'home-store/Home_2.jpg',
    was: [],
    alt: 'Bouteilles de vins portugais alignées devant les étagères de la boutique',
  },
  table: {
    file: 'snack-menu/Snack_3.jpg',
    was: ['Home_8.jpg'],
    alt: 'Sandwich chaud aux frites allumettes, servi avec un verre de vin rouge',
  },
  catering: {
    file: 'catering-events/Catering_4.jpg',
    was: ['Catering_9.jpg'],
    alt: 'Table de réception couverte de fruits, macarons et douceurs devant le mur de vins',
  },
  events: {
    file: 'owners-team/Owners_2.jpg',
    was: ['Home_11.jpg'],
    alt: 'Une soirée musicale à la Maison, verre de vin à la main',
  },
  contact: {
    file: 'home-store/Home_9.jpg',
    was: [],
    alt: 'Le salon de la boutique au soleil, devant les étagères de vins',
  },
};
// The photo in the media library by its file name (also as a "-1" copy), uploaded from public/brand when it is not there.
const mediaId = async (file: string, alt: string) => {
  const [stem, ext] = file.split('/').pop()!.split('.');
  const found = await payload.find({
    collection: 'media',
    where: { filename: { like: stem } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  });
  const same = found.docs.find((d) => new RegExp(`^${stem}(-\\d+)?\\.${ext}$`).test(d.filename ?? ''));
  return (
    same ??
    (await payload.create({
      collection: 'media',
      data: { alt },
      filePath: `public/brand/${file}`,
      locale: 'fr',
      overrideAccess: true,
    }))
  ).id;
};
const home = await payload.findGlobal({ slug: 'HomePage', depth: 1, overrideAccess: true });
const photos: Record<string, unknown> = { ...(home.photos ?? {}) };
let moved = 0;
for (const [slot, { file, was, alt }] of Object.entries(HOME)) {
  const current = photos[slot] as { filename?: string } | string | null | undefined;
  const name = typeof current === 'object' && current ? current.filename : undefined;
  // Payload adds "-1" to a name already taken (Home_8-1.jpg).
  if (current && !(name && was.includes(name.replace(/-\d+(\.\w+)$/, '$1')))) continue;
  console.info(`[home] ${slot}: ${name ?? 'empty'} → ${file.split('/').pop()}`);
  moved++;
  if (!check) photos[slot] = await mediaId(file, alt);
}
// The photo band under the banners: ten of the house's photos while staff have chosen none.
const GALLERY: [string, string][] = [
  ['home-store/Home_0.jpg', 'La salle et le mur de vins de la boutique'],
  ['catering-events/Catering_1.jpg', 'Plateau de réception : fromages, charcuterie et fruits'],
  ['owners-team/Owners_8.jpg', 'Les propriétaires partageant un verre de vin rouge'],
  ['shop-wines-gourmet/Shop_8.jpg', 'Une bouteille de vin rouge et un verre devant une guitare portugaise'],
  ['catering-events/Catering_11.jpg', 'Une grande table de réception dressée dans la boutique'],
  ['snack-menu/Snack_7.jpg', 'Jambon, olives et vin rouge sur la table'],
  ['owners-team/Owners_5.jpg', 'L’équipe Golden Grape réunie dans la boutique'],
  ['shop-wines-gourmet/Shop_16.jpg', 'Plateau garni de vins, biscuits et confiture portugaise'],
  ['home-store/Home_11.jpg', 'Le coin piano de la Maison, entre miroirs et oliviers'],
  ['shop-wines-gourmet/Shop_37.jpg', 'Caisses en bois garnies de vins, fromage et produits fins'],
];
const galleryEmpty = !home.gallery?.length;
if (galleryEmpty) console.info(`[home] gallery: empty → ${GALLERY.length} photos`);
if ((moved > 0 || galleryEmpty) && !check) {
  const ids = Object.fromEntries(
    Object.entries(photos).map(([k, v]) => [k, typeof v === 'object' && v ? (v as { id: string }).id : v]),
  );
  const gallery = galleryEmpty ? await Promise.all(GALLERY.map(([file, alt]) => mediaId(file, alt))) : undefined;
  // Outside Next the cache tag cannot be cleared here: the deploy's fresh build shows the new photos.
  await payload.updateGlobal({
    slug: 'HomePage',
    data: { photos: ids, ...(gallery ? { gallery } : {}) } as never,
    depth: 0,
    overrideAccess: true,
    context: { skipRevalidate: true },
  });
}
console.info(`[home] ${check ? 'would set' : 'set'} ${moved} photo(s)${galleryEmpty ? ' and the gallery' : ''}.`);
// Client request 18 Nov: tables are booked 11:30–17:30, every quarter hour, at least 30 min ahead. Set once, while the
// table rule has no first or last slot yet; from then on Ivo edits them (Réglages › Créneaux › Tables).
const tableRule = await model(payload, 'slotRules')
  .findOne({ mode: 'table' }, { firstSlot: 1, lastSlot: 1, intervalMin: 1, leadTimeMin: 1, capacityPerSlot: 1 })
  .lean<{
    _id: unknown;
    firstSlot?: string;
    lastSlot?: string;
    intervalMin?: number;
    leadTimeMin?: number;
    capacityPerSlot?: number;
  }>();
if (tableRule && !tableRule.firstSlot && !tableRule.lastSlot) {
  console.info(
    `[tables] ${tableRule.intervalMin} min, ${tableRule.leadTimeMin} min notice → 11:30–17:30, every 15 min, 30 min notice (capacity stays ${tableRule.capacityPerSlot} guests per slot, now per quarter hour)`,
  );
  if (!check)
    await model(payload, 'slotRules').updateOne(
      { _id: tableRule._id },
      { $set: { firstSlot: '11:30', lastSlot: '17:30', intervalMin: 15, leadTimeMin: 30 } },
    );
} else console.info(`[tables] ${tableRule ? 'hours already set, left alone' : 'no table rule'}.`);
process.exit(0);
