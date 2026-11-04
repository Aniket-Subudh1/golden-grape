// Idempotent seed: first admin, business settings, globals, the Maison page, legal stubs (draft),
// catering packages and events, the prototype's catalogue (until DEP-04), plus the client's photos as media.
// Re-running overwrites CMS edits to these.
// Run: npm run seed -- --email you@example.lu --password '…' --name 'Your Name'
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type CollectionSlug, getPayload } from 'payload';
import { interpolate, type Locale } from '@/lib/i18n';
import { nextWeekly } from '@/lib/time';
import { indexesReady } from '@/lib/tx';
import { type CatalogueRow, importCatalogue } from '@/modules/catalogue/import';
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
  // Home page photos (the prototype's lib/brand.ts slots that had no CMS photo yet).
  hero: { file: 'home-store/Home_9.jpg', alt: { fr: 'Le salon de la boutique : fauteuils, table basse et mur de bouteilles', en: 'The shop’s lounge: armchairs, low table and a wall of bottles', de: 'Die Lounge des Ladens: Sessel, Couchtisch und eine Wand voller Flaschen', pt: 'O salão da loja: cadeirões, mesa baixa e uma parede de garrafas' } },
  sandwiches: { file: 'catering-events/Catering_7.jpg', alt: { fr: 'Petits pains garnis servis sur une salade de tomates cerises', en: 'Filled bread rolls served on a cherry-tomato salad', de: 'Belegte Brötchen auf einem Kirschtomatensalat', pt: 'Pãezinhos recheados servidos sobre salada de tomate-cereja' } },
  // Product photos: the prototype's choice per product (its routes/shop.tsx and snack.tsx), several reused as stand-ins.
  wines: { file: 'home-store/Home_2.jpg', alt: { fr: 'Bouteilles de vins portugais alignées devant les étagères de la boutique', en: 'Portuguese wine bottles lined up in front of the shop’s shelves', de: 'Portugiesische Weinflaschen vor den Regalen des Ladens', pt: 'Garrafas de vinho português alinhadas diante das prateleiras da loja' } },
  board: { file: 'shop-wines-gourmet/Shop_5.jpg', alt: { fr: 'Une bouteille de rouge du Douro sur une planche avec raisins et jambon', en: 'A bottle of Douro red on a board with grapes and cured ham', de: 'Eine Flasche Douro-Rotwein auf einem Brett mit Trauben und Schinken', pt: 'Uma garrafa de tinto do Douro numa tábua com uvas e presunto' } },
  bottleGuitar: { file: 'shop-wines-gourmet/Shop_8.jpg', alt: { fr: 'Une bouteille de vin rouge et un verre devant une guitare portugaise', en: 'A bottle of red wine and a glass in front of a Portuguese guitar', de: 'Eine Flasche Rotwein und ein Glas vor einer portugiesischen Gitarre', pt: 'Uma garrafa de vinho tinto e um copo diante de uma guitarra portuguesa' } },
  accessories: { file: 'shop-wines-gourmet/Shop_6.jpg', alt: { fr: 'Coffrets d’accessoires pour le vin sur une étagère en bois', en: 'Wine accessory gift sets on a wooden shelf', de: 'Weinzubehör-Geschenksets auf einem Holzregal', pt: 'Conjuntos de acessórios de vinho numa prateleira de madeira' } },
  charcuterie: { file: 'snack-menu/Snack_7.jpg', alt: { fr: 'Planche de charcuterie, fromage et olives avec un verre de vin rouge', en: 'Board of cured meats, cheese and olives with a glass of red wine', de: 'Platte mit Aufschnitt, Käse und Oliven und einem Glas Rotwein', pt: 'Tábua de enchidos, queijo e azeitonas com um copo de vinho tinto' } },
  server: { file: 'catering-events/Catering_10.jpg', alt: { fr: 'Plateau de charcuterie, fromages, fruits et pain présenté dans la boutique', en: 'Platter of cured meats, cheeses, fruit and bread presented in the shop', de: 'Platte mit Aufschnitt, Käse, Obst und Brot im Laden', pt: 'Travessa de enchidos, queijos, fruta e pão apresentada na loja' } },
  tray: { file: 'shop-wines-gourmet/Shop_16.jpg', alt: { fr: 'Plateau garni de vins, biscuits et confiture portugaise', en: 'Tray filled with wines, biscuits and Portuguese jam', de: 'Tablett mit Weinen, Gebäck und portugiesischer Konfitüre', pt: 'Tabuleiro com vinhos, bolachas e doce português' } },
  giftBasket: { file: 'shop-wines-gourmet/Shop_14.jpg', alt: { fr: 'Panier cadeau avec vins, aguardente et produits portugais', en: 'Gift basket with wines, aguardente and Portuguese delicacies', de: 'Geschenkkorb mit Weinen, Aguardente und portugiesischen Spezialitäten', pt: 'Cesto de oferta com vinhos, aguardente e produtos portugueses' } },
  crates: { file: 'shop-wines-gourmet/Shop_37.jpg', alt: { fr: 'Caisses en bois garnies de vins, fromage et produits fins', en: 'Wooden crates filled with wines, cheese and fine foods', de: 'Holzkisten mit Weinen, Käse und Feinkost', pt: 'Caixas de madeira com vinhos, queijo e produtos finos' } },
  bifana: { file: 'snack-menu/Snack_3.jpg', alt: { fr: 'Sandwich chaud aux frites allumettes, servi avec un verre de vin rouge', en: 'Hot sandwich with straw fries, served with a glass of red wine', de: 'Warmes Sandwich mit Strohkartoffeln und einem Glas Rotwein', pt: 'Sanduíche quente com batata palha e um copo de vinho tinto' } },
  pasta: { file: 'snack-menu/Snack_2.jpg', alt: { fr: 'Bol de pâtes au parmesan avec un verre de vin rouge', en: 'Bowl of pasta with parmesan and a glass of red wine', de: 'Schale Pasta mit Parmesan und einem Glas Rotwein', pt: 'Taça de massa com parmesão e um copo de vinho tinto' } },
  bacalhau: { file: 'snack-menu/Snack_6.jpg', alt: { fr: 'Bacalhau à Brás aux olives noires, avec un verre de vin rouge', en: 'Bacalhau à Brás with black olives and a glass of red wine', de: 'Bacalhau à Brás mit schwarzen Oliven und einem Glas Rotwein', pt: 'Bacalhau à Brás com azeitonas pretas e um copo de vinho tinto' } },
  dessert: { file: 'snack-menu/Snack_1.jpg', alt: { fr: 'Deux parts de gâteau et des cafés servis sur des assiettes dorées', en: 'Two slices of cake and coffees served on gold plates', de: 'Zwei Stück Kuchen und Kaffee auf goldenen Tellern', pt: 'Duas fatias de bolo e cafés servidos em pratos dourados' } },
  pizza: { file: 'snack-menu/Snack_5.jpg', alt: { fr: 'Pizza à la tomate et au fromage coupée en parts', en: 'Tomato and cheese pizza cut into slices', de: 'Tomaten-Käse-Pizza in Stücken', pt: 'Piza de tomate e queijo cortada em fatias' } },
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

// The prototype's catalogue until the client's spreadsheet arrives (DEP-04): its PRODUCTS and MENU arrays (price,
// photo, category, tag) with the texts that were in the dictionaries. VAT classes are assumption A-12 (DEP-07).
// No barcodes and no opening stock: the real spreadsheet sets them, and its opening stock is posted only for a
// size with no movement yet.
const SHOP_CATEGORIES = ['wines', 'port', 'beers', 'cheese', 'charcuterie', 'grocery', 'gifts'] as const;
type ShopCategory = (typeof SHOP_CATEGORIES)[number];
const KIND: Record<ShopCategory, CatalogueRow['kind']> = { wines: 'wine', port: 'wine', beers: 'wine', cheese: 'grocery', charcuterie: 'grocery', grocery: 'grocery', gifts: 'gift' };
const VAT: Record<ShopCategory, CatalogueRow['vat_class']> = { wines: 'intermediate', port: 'standard', beers: 'standard', cheese: 'superReduced', charcuterie: 'superReduced', grocery: 'superReduced', gifts: 'standard' };
const SHOP: [id: keyof Content['catalogue']['products'], price: number, photo: string, category: ShopCategory, badge?: string][] = [
  ['douro-reserva', 3200, 'wines', 'wines', 'signature'],
  ['alentejo-tinto', 2100, 'board', 'wines'],
  ['vinho-verde', 1400, 'bottleGuitar', 'wines'],
  ['dao-quinta', 2600, 'table', 'wines'],
  ['port-tawny', 6800, 'aguardente', 'port', 'rare'],
  ['port-lbv', 2400, 'wines', 'port'],
  ['sagres', 1200, 'accessories', 'beers'],
  ['super-bock', 450, 'bottleGuitar', 'beers'],
  ['sao-jorge', 1800, 'platter', 'cheese', 'dop'],
  ['serra', 2200, 'charcuterie', 'cheese'],
  ['chourico', 1200, 'charcuterie', 'charcuterie'],
  ['presunto', 1600, 'server', 'charcuterie', 'signature'],
  ['azeite', 1900, 'tray', 'grocery'],
  ['sardines', 900, 'tray', 'grocery'],
  ['flor-sal', 800, 'board', 'grocery'],
  ['box-descoberta', 8900, 'giftBasket', 'gifts', 'bestseller'],
  ['box-prestige', 22000, 'crates', 'gifts'],
  ['box-porto', 6500, 'giftBasket', 'gifts'],
];
// The glass of wine is an alcoholic drink (standard VAT); the dishes are food served on site (super-reduced).
const MENU: [id: keyof Content['catalogue']['menu'], price: number, photo: string, badge?: string][] = [
  ['bifana', 650, 'bifana', 'signature'],
  ['prego', 850, 'pasta'],
  ['alheira', 1200, 'bacalhau'],
  ['pastel', 220, 'dessert', 'homemade'],
  ['queijo', 1600, 'charcuterie'],
  ['vinho', 700, 'pizza'],
];

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

async function global(slug: 'BusinessSettings' | 'Header' | 'Footer' | 'HappyHour' | 'HomePage', build: (l: Locale) => Record<string, unknown>) {
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

// 3. Business settings (contact details and hours from the prototype; LU VAT until DEP-07). What staff already
// entered wins: the seed only fills empty fields (bank details, edited hours and contact stay as they are).
const current = await payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true });
const filled = <T extends Record<string, unknown>>(seed: T, saved: Record<string, unknown> | null | undefined): T =>
  ({ ...seed, ...Object.fromEntries(Object.entries(saved ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '')) }) as T;
await global('BusinessSettings', () => ({
  business: filled({
    name: 'Golden Grape Luxembourg',
    street: '25 Zac Klengbousbierg',
    postalCode: '7795',
    city: 'Bissen',
    country: 'Luxembourg',
    phone: '+352 691 855 844',
    email: 'hello@goldengrape.lu',
    instagram: 'https://www.instagram.com/goldengrape.lu/',
  }, current.business),
  hours: current.hours?.length ? current.hours : [1, 2, 3, 4, 5].map((day) => ({ day: String(day), open: '10:00', close: '18:00' })),
  vat: current.vat?.length ? current.vat : [
    { key: 'standard', rateBp: 1700 },
    { key: 'intermediate', rateBp: 1400 },
    { key: 'reduced', rateBp: 800 },
    { key: 'superReduced', rateBp: 300 },
  ],
}));
log('BusinessSettings saved');

// 4. Header, Footer, Happy Hour.
await global('Header', (l) => {
  const n = c(l).nav;
  return {
    navItems: [
      { label: n.shop, href: '/shop' },
      { label: n.snack, href: '/snack' },
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
      { title: f.colMaison, links: [{ label: f.links.history, href: '/maison' }, { label: f.links.shop, href: '/shop' }, { label: f.links.counter, href: '/snack' }, { label: f.links.contact, href: '/contact' }] },
      { title: f.colServices, links: [{ label: f.links.catering, href: '/catering' }, { label: f.links.events, href: '/events' }, { label: f.links.happy, href: '/events' }, { label: f.links.gifts }] },
    ],
  };
});
await global('HappyHour', (l) => ({ active: true, days: ['3', '4', '5'], from: '17:00', to: '20:00', ...c(l).happyHour, image: media.table }));
log('Header, Footer, HappyHour saved');

// The home page's photos (titles stay as edited; empty ones fall back to the dictionary on the site).
await global('HomePage', () => ({
  hero: { image: media.hero },
  photos: {
    shop: media.giftBasket,
    snack: media.bifana,
    catering: media.grazing,
    events: media.piano,
    port: media.aguardente,
    cheese: media.platter,
    pastel: media.dessert,
    table: media.sandwiches,
    interior: media.interior,
  },
}));
log('HomePage photos saved');

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
      {
        blockType: 'cta',
        eyebrow: m.ctaEyebrow,
        titleA: m.ctaTitleA,
        titleB: m.ctaTitleB,
        subtitle: m.ctaSubtitle,
        buttons: [
          { label: m.ctaContact, href: '/contact', style: 'solid' },
          { label: m.ctaShop, href: '/shop', style: 'outline' },
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

// 9. Catalogue: categories, then the products through the catalogue import (same validation and upsert as a CSV)
for (const [i, key] of [...SHOP_CATEGORIES, 'counter' as const].entries()) {
  await upsert('categories', { slug: { equals: key } }, (l) => ({
    name: key === 'counter' ? c(l).catalogue.counter : c(l).catalogue.categories[key],
    slug: key,
    kind: key === 'counter' ? 'snack' : 'shop',
    order: i + 1,
  }));
}
const names = <K extends 'products' | 'menu'>(group: K, id: keyof Content['catalogue'][K]) =>
  Object.fromEntries(LOCALES.map((l) => [`name_${l}`, (c(l).catalogue[group] as Record<string, { name: string }>)[id as string].name])) as Record<`name_${Locale}`, string>;
const rows: CatalogueRow[] = [
  ...SHOP.map(([id, price, photo, category, badge]): CatalogueRow => ({
    ...names('products', id),
    sku: `GG-${id.toUpperCase()}`,
    slug: id,
    kind: KIND[category],
    category_slug: category,
    region_fr: KIND[category] === 'wine' && category !== 'beers' ? c('fr').catalogue.products[id].region : undefined,
    vat_class: VAT[category],
    price_eur: price,
    images: [media[photo]],
    badges: badge ? [badge] : [],
  } as CatalogueRow)),
  ...MENU.map(([id, price, photo, badge]): CatalogueRow => ({
    ...names('menu', id),
    sku: `GG-${id.toUpperCase()}`,
    slug: id,
    kind: 'snack',
    category_slug: 'counter',
    vat_class: id === 'vinho' ? 'standard' : 'superReduced',
    price_eur: price,
    images: [media[photo]],
    badges: badge ? [badge] : [],
    description: Object.fromEntries(LOCALES.map((l) => [l, richText(node('paragraph', c(l).catalogue.menu[id].desc))])),
  } as CatalogueRow)),
];
const imported = await importCatalogue(payload, rows);
if (imported.errors.length) throw new Error(`catalogue: ${imported.errors.map((e) => `row ${e.row} ${e.column}: ${e.message}`).join('; ')}`);
log(`catalogue: ${SHOP_CATEGORIES.length + 1} categories, ${imported.created} products created, ${imported.updated} updated`);

// 10. Time slots and delivery areas: assumption A-05 until DEP-06 (zones, hours, slot rules). Created only when missing,
// so what staff set in the admin is never overwritten. Every mode follows the shop's opening hours.
const SLOT_RULES = [
  { mode: 'pickup', intervalMin: 30, capacityPerSlot: 4, leadTimeMin: 60, maxDaysAhead: 14 },
  { mode: 'delivery', intervalMin: 60, capacityPerSlot: 3, leadTimeMin: 120, maxDaysAhead: 14 },
  { mode: 'table', intervalMin: 30, capacityPerSlot: 16, leadTimeMin: 120, maxDaysAhead: 30 },
] as const;
for (const rule of SLOT_RULES) {
  const { totalDocs } = await payload.count({ collection: 'slotRules', where: { mode: { equals: rule.mode } }, overrideAccess: true });
  if (totalDocs === 0) await payload.create({ collection: 'slotRules', data: rule, overrideAccess: true, context: seedContext() });
}
const ZONES = [
  { name: 'Bissen', postalCodes: ['7760', '7770', '7780', '7790', '7795'], feeCents: 500, minOrderCents: 3000, freeFromCents: 8000 },
  { name: 'Mersch et Colmar-Berg', postalCodes: ['7501', '7510', '7520', '7530', '7540', '7550', '7730', '7740', '7750'], feeCents: 800, minOrderCents: 5000, freeFromCents: 12000 },
];
for (const zone of ZONES) {
  const { totalDocs } = await payload.count({ collection: 'deliveryZones', where: { name: { equals: zone.name } }, overrideAccess: true });
  if (totalDocs === 0) await payload.create({ collection: 'deliveryZones', data: { ...zone, active: true }, overrideAccess: true, context: seedContext() });
}
log(`time slots (${SLOT_RULES.length} modes) and ${ZONES.length} delivery areas checked`);

await payload.destroy();
log('done');
process.exit(0);
