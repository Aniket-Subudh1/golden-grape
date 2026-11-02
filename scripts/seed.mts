// Idempotent seed: first admin, business settings, globals, the Maison page, legal stubs (draft),
// catering packages and events (draft), plus the brand stand-in photos as media.
// Run: npm run seed -- --email you@example.lu --password '…' --name 'Your Name'
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type CollectionSlug, getPayload } from 'payload';
import { interpolate, type Locale } from '@/lib/i18n';
import { indexesReady } from '@/lib/tx';
import content from './seed-content.json';

const LOCALES: Locale[] = ['fr', 'en', 'de', 'pt'];
const OTHERS = LOCALES.slice(1);
const context = { skipRevalidate: true }; // no Next.js runtime here
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

const ALTS: Record<string, Record<Locale, string>> = {
  'hero-wine': { fr: 'Vin rouge versé dans un verre', en: 'Red wine poured into a glass', de: 'Rotwein wird in ein Glas gegossen', pt: 'Vinho tinto a ser servido num copo' },
  'store-interior': { fr: 'Intérieur de la boutique Golden Grape', en: 'Inside the Golden Grape shop', de: 'Innenansicht des Golden-Grape-Ladens', pt: 'Interior da loja Golden Grape' },
  'universe-shop': { fr: 'Bouteilles de vins portugais', en: 'Bottles of Portuguese wine', de: 'Flaschen portugiesischer Weine', pt: 'Garrafas de vinho português' },
  'universe-snack': { fr: 'Sandwich bifana au comptoir', en: 'Bifana sandwich at the counter', de: 'Bifana-Sandwich an der Theke', pt: 'Bifana ao balcão' },
  'universe-catering': { fr: 'Buffet traiteur portugais', en: 'Portuguese catering buffet', de: 'Portugiesisches Catering-Buffet', pt: 'Buffet de catering português' },
  'universe-events': { fr: 'Soirée à la Maison', en: 'An evening at the House', de: 'Ein Abend im Haus', pt: 'Serão na Casa' },
  'craft-cheese': { fr: 'Plateau de fromages portugais', en: 'Portuguese cheese board', de: 'Portugiesische Käseplatte', pt: 'Tábua de queijos portugueses' },
  'craft-port': { fr: 'Verre de Porto', en: 'Glass of Port', de: 'Ein Glas Portwein', pt: 'Copo de vinho do Porto' },
  'craft-pastel': { fr: 'Pastel de nata', en: 'Pastel de nata', de: 'Pastel de nata', pt: 'Pastel de nata' },
  'happy-hour': { fr: 'Table dressée pour l’apéritif', en: 'Table set for an aperitif', de: 'Gedeckter Tisch zum Aperitif', pt: 'Mesa posta para o aperitivo' },
  'gourmet-table': { fr: 'Table gourmande partagée', en: 'Shared gourmet table', de: 'Gedeckte Genießertafel', pt: 'Mesa gourmet partilhada' },
};

const LEGAL: Record<string, Record<Locale, string>> = {
  'mentions-legales': { fr: 'Mentions légales', en: 'Legal notice', de: 'Impressum', pt: 'Informação legal' },
  cgv: { fr: 'Conditions générales de vente', en: 'Terms and conditions of sale', de: 'Allgemeine Geschäftsbedingungen', pt: 'Condições gerais de venda' },
  confidentialite: { fr: 'Politique de confidentialité', en: 'Privacy policy', de: 'Datenschutzerklärung', pt: 'Política de privacidade' },
  cookies: { fr: 'Politique cookies', en: 'Cookie policy', de: 'Cookie-Richtlinie', pt: 'Política de cookies' },
};

// Prototype events (dates are past, so they are seeded as drafts for the client to reschedule).
const EVENTS = [
  { key: 'fri', slug: 'soiree-fado', start: '2026-08-08T19:00:00+02:00', end: '2026-08-08T23:00:00+02:00', priceCents: 4500, capacity: 40, image: 'universe-events' },
  { key: 'hh', slug: 'golden-hour', start: '2026-08-06T17:00:00+02:00', end: '2026-08-06T20:00:00+02:00', priceCents: 2400, capacity: 40, image: 'happy-hour' },
  { key: 'tast', slug: 'degustation-douro', start: '2026-08-16T16:00:00+02:00', end: '2026-08-16T18:00:00+02:00', priceCents: 6500, capacity: 20, image: 'craft-port' },
  { key: 'chef', slug: 'table-du-chef', start: '2026-08-21T20:00:00+02:00', end: '2026-08-21T23:00:00+02:00', priceCents: 12000, capacity: 12, image: 'gourmet-table' },
] as const;

const PACKAGES = [
  { key: 'convivio', order: 1, priceCents: 2800, image: 'craft-cheese' },
  { key: 'mesa', order: 2, priceCents: 5500, image: 'gourmet-table' },
  { key: 'prestige', order: 3, priceCents: 9500, image: 'universe-catering' },
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
    ? await payload.update({ collection, id: found.docs[0].id, data: build('fr') as never, locale: 'fr', depth: 0, draft, overrideAccess: true, context })
    : await payload.create({ collection, data: build('fr') as never, locale: 'fr', depth: 0, draft, overrideAccess: true, context });
  for (const l of OTHERS) {
    saved = await payload.update({ collection, id: saved.id, data: withIds(build(l), saved) as never, locale: l, depth: 0, draft, overrideAccess: true, context });
  }
  return saved;
}

async function global(slug: 'BusinessSettings' | 'Header' | 'Footer' | 'HappyHour', build: (l: Locale) => Record<string, unknown>) {
  let saved = await payload.updateGlobal({ slug, data: build('fr') as never, locale: 'fr', depth: 0, overrideAccess: true, context });
  for (const l of OTHERS) {
    saved = await payload.updateGlobal({ slug, data: withIds(build(l), saved) as never, locale: l, depth: 0, overrideAccess: true, context });
  }
}

// 1. First admin
const admins = await payload.count({ collection: 'users', where: { roles: { in: ['admin'] } }, overrideAccess: true });
if (args.email && args.password && args.name) {
  const existing = await payload.find({ collection: 'users', where: { email: { equals: args.email } }, limit: 1, overrideAccess: true });
  if (existing.docs.length) log(`admin ${args.email} already exists`);
  else {
    await payload.create({ collection: 'users', data: { email: args.email, password: args.password, name: args.name, roles: ['admin'], active: true, locale: 'fr' }, overrideAccess: true, context });
    log(`admin ${args.email} created`);
  }
} else if (admins.totalDocs === 0) {
  throw new Error('No admin yet: pass --email, --password and --name');
}

// 2. Media (brand stand-ins until the original photos arrive, DEP-01)
const media: Record<string, string> = {};
for (const [name, alts] of Object.entries(ALTS)) {
  const filename = `${name}.jpg`;
  const found = await payload.find({ collection: 'media', where: { filename: { equals: filename } }, limit: 1, depth: 0, overrideAccess: true });
  let doc = found.docs[0];
  if (!doc) {
    doc = await payload.create({ collection: 'media', data: { alt: alts.fr }, filePath: path.resolve('public/brand', filename), locale: 'fr', overrideAccess: true, context });
    log(`media ${filename} uploaded`);
  }
  for (const l of LOCALES) await payload.update({ collection: 'media', id: doc.id, data: { alt: alts[l] }, locale: l, overrideAccess: true, context });
  media[name] = doc.id;
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
await global('HappyHour', (l) => ({ active: true, days: ['3', '4', '5'], from: '17:00', to: '20:00', ...c(l).happyHour, image: media['happy-hour'] }));
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
      { blockType: 'hero', eyebrow: m.eyebrow, titleA: m.titleA, titleB: m.titleB, subtitle: m.subtitle, image: media['store-interior'] },
      {
        blockType: 'mediaText',
        image: media['gourmet-table'],
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
          image: media[['craft-port', 'universe-shop', 'universe-events'][i]],
          eyebrow: p.region,
          title: p.name,
          text: interpolate(m.since, { year: p.year }),
        })),
      },
      {
        blockType: 'cardGrid',
        variant: 'dark',
        cards: m.values.map((v, i) => ({ image: media[['universe-snack', 'universe-catering', 'craft-cheese'][i]], eyebrow: v.t, title: v.d })),
      },
      // The prototype's second button (shop) returns when the shop exists (M2.2).
      { blockType: 'cta', eyebrow: m.ctaEyebrow, titleA: m.ctaTitleA, titleB: m.ctaTitleB, subtitle: m.ctaSubtitle, buttons: [{ label: m.ctaContact, href: '/contact', style: 'solid' }] },
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

// 8. Events, as drafts
for (const e of EVENTS) {
  await upsert(
    'events',
    { slug: { equals: e.slug } },
    (l) => {
      const ev = c(l).events[e.key];
      return {
        title: ev.title,
        slug: e.slug,
        _status: 'draft',
        startsAt: new Date(e.start).toISOString(),
        endsAt: new Date(e.end).toISOString(),
        description: ev.desc,
        priceCents: e.priceCents,
        capacity: e.capacity,
        image: media[e.image],
      };
    },
    true,
  );
}
log('4 events saved as drafts');

await payload.destroy();
log('done');
process.exit(0);
