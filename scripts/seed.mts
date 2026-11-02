// Idempotent seed: first admin, business settings, globals, the Maison page, legal stubs (draft),
// catering packages and events, plus the client's photos as media. Re-running overwrites CMS edits to these.
// Run: npm run seed -- --email you@example.lu --password '…' --name 'Your Name'
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type CollectionSlug, getPayload } from 'payload';
import { interpolate, type Locale } from '@/lib/i18n';
import { nextWeekly } from '@/lib/time';
import { indexesReady } from '@/lib/tx';
import content from './seed-content.json';

const LOCALES: Locale[] = ['fr', 'en', 'de', 'pt'];
const OTHERS = LOCALES.slice(1);
// A fresh object per call: no Next.js runtime here (skipRevalidate), and the storage plugin marks the context
// it is given as `skipCloudStorage` after an upload, so a shared object silently skips every later upload.
const seedContext = () => ({ skipRevalidate: true });
type Content = (typeof content)['fr'];
const c = (l: Locale): Content => content[l];

// ---- helpers ---------------------------------------------------------------------------------------

/** Copies row ids from the saved FR document into the data for another locale, so localized fields
 * inside arrays and blocks update the existing rows instead of creating new ones. */
function withIds(data: unknown, saved: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      const prev = Array.isArray(saved) ? (saved[i] as { id?: unknown } | undefined) : undefined;
      const merged = withIds(item, prev);
      return prev?.id && merged && typeof merged === 'object' ? { ...merged, id: prev.id } : merged;
    });
  }
  if (data && typeof data === 'object') {
    const prev = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, withIds(v, prev[k])]));
  }
  return data;
}

const text = (value: string) => ({ type: 'text', text: value, version: 1, format: 0, mode: 'normal', style: '', detail: 0 });
const node = (type: 'paragraph' | 'quote', value: string) => ({
  type,
  version: 1,
  children: [text(value)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  ...(type === 'paragraph' ? { textFormat: 0 } : {}),
});
const richText = (...children: ReturnType<typeof node>[]) => ({
  root: { type: 'root', version: 1, children, direction: 'ltr' as const, format: '' as const, indent: 0 },
});

// ---- data --------------------------------------------------------------------------------------------

// The client's photos used by CMS content, with the prototype's slot for each (its lib/brand.ts).
const PHOTOS: Record<string, { file: string; alt: Record<Locale, string> }> = {
  interior: { file: 'home-store/Home_0.jpg', alt: { fr: 'La salle et le mur de vins de la boutique', en: 'The room and wine wall of the shop', de: 'Der Raum und die Weinwand des Ladens', pt: 'A sala e a parede de vinhos da loja' } },
  table: { file: 'home-store/Home_8.jpg', alt: { fr: 'Verres et serviettes sur une table devant les vins', en: 'Glasses and napkins on a table in front of the wines', de: 'Gläser und Servietten auf einem Tisch vor den Weinen', pt: 'Copos e guardanapos numa mesa diante dos vinhos' } },
  piano: { file: 'home-store/Home_11.jpg', alt: { fr: 'Le coin piano de la Maison, entre miroirs et oliviers', en: 'The House’s piano corner, among mirrors and olive trees', de: 'Die Klavierecke des Hauses zwischen Spiegeln und Olivenbäumen', pt: 'O canto do piano da Casa, entre espelhos e oliveiras' } },
  olive: { file: 'home-store/Home_18.jpg', alt: { fr: 'Branches d’olivier devant les étagères de vins', en: 'Olive branches in front of the wine shelves', de: 'Olivenzweige vor den Weinregalen', pt: 'Ramos de oliveira diante das prateleiras de vinho' } },
  outside: { file: 'owners-team/Owners_4.jpg', alt: { fr: 'Les propriétaires marchant en plein air', en: 'The owners walking outdoors', de: 'Die Inhaber im Freien', pt: 'Os proprietários a caminhar ao ar livre' } },
  team: { file: 'owners-team/Owners_5.jpg', alt: { fr: 'L’équipe Golden Grape réunie dans la boutique', en: 'The Golden Grape team together in the shop', de: 'Das Golden-Grape-Team im Laden', pt: 'A equipa Golden Grape reunida na loja' } },
  together: { file: 'owners-team/Owners_8.jpg', alt: { fr: 'Les propriétaires partageant un verre de vin rouge dans la cave', en: 'The owners sharing a glass of red wine in the cellar', de: 'Die Inhaber bei einem Glas Rotwein im Weinkeller', pt: 'Os proprietários a partilhar um copo de vinho tinto na garrafeira' } },
  cellar: { file: 'owners-team/Owners_9.jpg', alt: { fr: 'Une bouteille à la main, devant les casiers de la cave', en: 'Bottle in hand, in front of the cellar racks', de: 'Mit einer Flasche in der Hand vor den Weinregalen', pt: 'De garrafa na mão, diante das prateleiras da garrafeira' } },
  aguardente: { file: 'shop-wines-gourmet/Shop_9.jpg', alt: { fr: 'Une bouteille d’aguardente vínica présentée à la main', en: 'A bottle of aguardente vínica held in the hand', de: 'Eine Flasche Aguardente Vínica in der Hand', pt: 'Uma garrafa de aguardente vínica na mão' } },
  platter: { file: 'catering-events/Catering_1.jpg', alt: { fr: 'Plateau traiteur de fromages, charcuterie et fruits', en: 'Catering platter of cheese, charcuterie and fruit', de: 'Catering-Platte mit Käse, Aufschnitt und Obst', pt: 'Travessa de catering com queijos, enchidos e fruta' } },
  risotto: { file: 'catering-events/Catering_8.jpg', alt: { fr: 'Assiette de risotto servie à table', en: 'A plate of risotto served at the table', de: 'Ein Teller Risotto am Tisch serviert', pt: 'Prato de risoto servido à mesa' } },
  grazing: { file: 'catering-events/Catering_9.jpg', alt: { fr: 'Longue table traiteur garnie de fromages et de pains', en: 'Long catering table laden with cheese and bread', de: 'Lange Catering-Tafel mit Käse und Brot', pt: 'Longa mesa de catering com queijos e pão' } },
  ivoTable: { file: 'catering-events/Catering_11.jpg', alt: { fr: 'Une grande table traiteur dressée dans la boutique', en: 'A large catering table laid out in the shop', de: 'Eine große Catering-Tafel im Laden', pt: 'Uma grande mesa de catering na loja' } },
};

const LEGAL: Record<string, Record<Locale, string>> = {
  'mentions-legales': { fr: 'Mentions légales', en: 'Legal notice', de: 'Impressum', pt: 'Informação legal' },
  cgv: { fr: 'Conditions générales de vente', en: 'Terms and conditions of sale', de: 'Allgemeine Geschäftsbedingungen', pt: 'Condições gerais de venda' },
  confidentialite: { fr: 'Politique de confidentialité', en: 'Privacy policy', de: 'Datenschutzerklärung', pt: 'Política de privacidade' },
  cookies: { fr: 'Politique cookies', en: 'Cookie policy', de: 'Cookie-Richtlinie', pt: 'Política de cookies' },
};

// The prototype's four events. Its dates (August 2026) are past, so each is published on the next matching
// weekday: the client must confirm or replace these dates in the admin. Re-running the seed moves them again.
const EVENTS = [
  { key: 'fri', slug: 'soiree-fado', weekday: 5, start: '19:00', hours: 4, priceCents: 4500, capacity: 40, image: 'piano' },
  { key: 'hh', slug: 'golden-hour', weekday: 3, start: '17:00', hours: 3, priceCents: 2400, capacity: 40, image: 'table' },
  { key: 'tast', slug: 'degustation-douro', weekday: 6, start: '16:00', hours: 2, priceCents: 6500, capacity: 20, image: 'cellar' },
  { key: 'chef', slug: 'table-du-chef', weekday: 4, start: '20:00', hours: 3, priceCents: 12000, capacity: 12, image: 'risotto' },
] as const;

const PACKAGES = [
  { key: 'convivio', order: 1, priceCents: 2800, image: 'platter' },
  { key: 'mesa', order: 2, priceCents: 5500, image: 'grazing' },
  { key: 'prestige', order: 3, priceCents: 9500, image: 'ivoTable' },
] as const;
const MIN_GUESTS = 10; // assumption A-11 until Golden Grape confirms

// ---- run -----------------------------------------------------------------------------------------------

const { values: args } = parseArgs({ options: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } } });
// Dynamic import: payload.config.ts compiles as CommonJS, and a static default import from this ES module
// would receive the CommonJS wrapper instead of the config.
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);
const log = (message: string) => console.info(`[seed] ${message}`);

/** Creates (or updates) a document keyed by a field, writing FR first and the other locales on the same rows. */
async function upsert(collection: CollectionSlug, where: Record<string, unknown>, build: (l: Locale) => Record<string, unknown>, draft = false) {
  const found = await payload.find({ collection, where: where as never, locale: 'fr', limit: 1, depth: 0, draft, overrideAccess: true });
  let saved = found.docs[0]
    ? await payload.update({ collection, id: found.docs[0].id, data: build('fr') as never, locale: 'fr', depth: 0, draft, overrideAccess: true, context: seedContext() })
    : await payload.create({ collection, data: build('fr') as never, locale: 'fr', depth: 0, draft, overrideAccess: true, context: seedContext() });
  for (const l of OTHERS) {
    saved = await payload.update({ collection, id: saved.id, data: withIds(build(l), saved) as never, locale: l, depth: 0, draft, overrideAccess: true, context: seedContext() });
  }
  return saved;
}

async function global(slug: 'BusinessSettings' | 'Header' | 'Footer' | 'HappyHour', build: (l: Locale) => Record<string, unknown>) {
  let saved = await payload.updateGlobal({ slug, data: build('fr') as never, locale: 'fr', depth: 0, overrideAccess: true, context: seedContext() });
  for (const l of OTHERS) {
    saved = await payload.updateGlobal({ slug, data: withIds(build(l), saved) as never, locale: l, depth: 0, overrideAccess: true, context: seedContext() });
  }
}

// 1. First admin
const admins = await payload.count({ collection: 'users', where: { roles: { in: ['admin'] } }, overrideAccess: true });
if (args.email && args.password && args.name) {
  const existing = await payload.find({ collection: 'users', where: { email: { equals: args.email } }, limit: 1, overrideAccess: true });
  if (existing.docs.length) log(`admin ${args.email} already exists`);
  else {
    await payload.create({ collection: 'users', data: { email: args.email, password: args.password, name: args.name, roles: ['admin'], active: true, locale: 'fr' }, overrideAccess: true, context: seedContext() });
    log(`admin ${args.email} created`);
  }
} else if (admins.totalDocs === 0) {
  throw new Error('No admin yet: pass --email, --password and --name');
}

// 2. Media: the client's original photos
const media: Record<string, string> = {};
for (const [slot, { file, alt }] of Object.entries(PHOTOS)) {
  const filename = path.basename(file);
  const found = await payload.find({ collection: 'media', where: { filename: { equals: filename } }, limit: 1, depth: 0, overrideAccess: true });
  let doc = found.docs[0];
  if (!doc) {
    doc = await payload.create({ collection: 'media', data: { alt: alt.fr }, filePath: path.resolve('public/brand', file), locale: 'fr', overrideAccess: true, context: seedContext() });
    log(`media ${filename} uploaded`);
  }
  for (const l of LOCALES) await payload.update({ collection: 'media', id: doc.id, data: { alt: alt[l] }, locale: l, overrideAccess: true, context: seedContext() });
  media[slot] = doc.id;
}

// 3. Business settings (contact details and hours from the prototype; LU VAT until DEP-07)
await global('BusinessSettings', () => ({
  business: {
    name: 'Golden Grape Luxembourg',
    street: '25 Zac Klengbousbierg',
    postalCode: '7795',
    city: 'Bissen',
    country: 'Luxembourg',
    phone: '+352 691 855 844',
    email: 'hello@goldengrape.lu',
    instagram: 'https://www.instagram.com/goldengrape.lu/',
  },
  hours: [1, 2, 3, 4, 5].map((day) => ({ day: String(day), open: '10:00', close: '18:00' })),
  vat: [
    { key: 'standard', rateBp: 1700 },
    { key: 'intermediate', rateBp: 1400 },
    { key: 'reduced', rateBp: 800 },
    { key: 'superReduced', rateBp: 300 },
  ],
}));
log('BusinessSettings saved');

// 4. Header, Footer, Happy Hour. Shop and Snack have no href until their pages exist (M2.2).
await global('Header', (l) => {
  const n = c(l).nav;
  return {
    navItems: [
      { label: n.shop },
      { label: n.snack },
      { label: n.catering, href: '/catering' },
      { label: n.events, href: '/events' },
      { label: n.maison, href: '/maison' },
      { label: n.contact, href: '/contact' },
    ],
  };
});
await global('Footer', (l) => {
  const f = c(l).footer;
  return {
    tagline: f.tagline,
    columns: [
      { title: f.colMaison, links: [{ label: f.links.history, href: '/maison' }, { label: f.links.shop }, { label: f.links.counter }, { label: f.links.contact, href: '/contact' }] },
      { title: f.colServices, links: [{ label: f.links.catering, href: '/catering' }, { label: f.links.events, href: '/events' }, { label: f.links.happy, href: '/events' }, { label: f.links.gifts }] },
    ],
  };
});
await global('HappyHour', (l) => ({ active: true, days: ['3', '4', '5'], from: '17:00', to: '20:00', ...c(l).happyHour, image: media.table }));
log('Header, Footer, HappyHour saved');

// 5. The Maison page, rebuilt from the prototype's sections as blocks
await upsert('pages', { slug: { equals: 'maison' } }, (l) => {
  const m = c(l).maison;
  return {
    title: `${m.titleA} ${m.titleB}`,
    slug: 'maison',
    _status: 'published',
    seo: { title: `${m.titleA} ${m.titleB} · Golden Grape Luxembourg`, description: m.subtitle },
    layout: [
      { blockType: 'hero', eyebrow: m.eyebrow, titleA: m.titleA, titleB: m.titleB, subtitle: m.subtitle, image: media.interior },
      {
        blockType: 'mediaText',
        image: media.together,
        imagePosition: 'left',
        eyebrow: m.founderEyebrow,
        titleA: m.founderTitleA,
        titleB: m.founderTitleB,
        body: richText(node('paragraph', m.founderP1), node('paragraph', m.founderP2), node('quote', m.founderQuote)),
      },
      {
        blockType: 'cardGrid',
        variant: 'hairline',
        eyebrow: m.regionsEyebrow,
        titleA: m.regionsTitleA,
        titleB: m.regionsTitleB,
        cards: Object.values(m.regions).map((r) => ({ title: r.name, text: r.desc })),
      },
      {
        blockType: 'cardGrid',
        variant: 'cards',
        eyebrow: m.producersEyebrow,
        titleA: m.producersTitleA,
        titleB: m.producersTitleB,
        cards: Object.values(m.producers).map((p, i) => ({
          image: media[['cellar', 'aguardente', 'outside'][i]],
          eyebrow: p.region,
          title: p.name,
          text: interpolate(m.since, { year: p.year }),
        })),
      },
      {
        blockType: 'cardGrid',
        variant: 'dark',
        cards: m.values.map((v, i) => ({ image: media[['team', 'grazing', 'olive'][i]], eyebrow: v.t, title: v.d })),
      },
      // The shop button gets its href when the shop exists (M2.2).
      {
        blockType: 'cta',
        eyebrow: m.ctaEyebrow,
        titleA: m.ctaTitleA,
        titleB: m.ctaTitleB,
        subtitle: m.ctaSubtitle,
        buttons: [
          { label: m.ctaContact, href: '/contact', style: 'solid' },
          { label: m.ctaShop, style: 'outline' },
        ],
      },
    ],
  };
});
log('page maison published');

// 6. Legal stubs: drafts until Golden Grape's texts arrive (DEP-05), so nothing placeholder is public.
for (const [slug, titles] of Object.entries(LEGAL)) {
  await upsert('legal', { slug: { equals: slug } }, (l) => ({ title: titles[l], slug, _status: 'draft', body: richText(node('paragraph', 'DEP-05')) }), true);
}
log('4 legal stubs saved as drafts');

// 7. Catering packages
for (const p of PACKAGES) {
  await upsert('cateringPackages', { name: { equals: c('fr').packages[p.key].name } }, (l) => {
    const pkg = c(l).packages[p.key];
    return {
      name: pkg.name,
      tagline: pkg.tagline,
      includes: pkg.includes.map((item) => ({ item })),
      pricePerGuestCents: p.priceCents,
      minGuests: MIN_GUESTS,
      order: p.order,
      image: media[p.image],
    };
  });
}
log('3 catering packages saved');

// 8. Events, published on their next real weekday
const now = new Date();
for (const e of EVENTS) {
  const start = nextWeekly([e.weekday], e.start, now);
  await upsert('events', { slug: { equals: e.slug } }, (l) => {
    const ev = c(l).events[e.key];
    return {
      title: ev.title,
      slug: e.slug,
      _status: 'published',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + e.hours * 3_600_000).toISOString(),
      description: ev.desc,
      priceCents: e.priceCents,
      capacity: e.capacity,
      image: media[e.image],
    };
  });
}
log('4 events published');

await payload.destroy();
log('done');
process.exit(0);
