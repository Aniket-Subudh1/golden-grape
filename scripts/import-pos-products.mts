// Imports the POS product export (DEP-04: CashMag "export_produits" .xlsx, 7 Nov 2026) into the catalogue.
// Columns used: Rubrique, Libellé, Codes barre, #ID, Coût de revient HT, GOLDEN GRAPE (selling price incl. VAT).
// - SKU = the POS #ID, so POS lines match these products later (M3.3 sales CSV, M4.2 CashMag).
// - Rubrique → category, kind, VAT class and producer through RUBRIQUES below (assumption A-13 until Golden Grape and
//   the accountant confirm). POS-only lines (fees, "Divers", delivery, gift cheque) are kept, archived.
// - New products are drafts: staff review and publish them. A re-run creates what is new in the POS and updates prices
//   and costs; it never undoes the review (category, producer, name, VAT, status), and an empty POS cell clears nothing.
// - Missing categories are created with their names from seed-content.json; existing ones are never renamed.
// Writes <file>.review.csv (one line per product, with what to check) and appends to <file>.log.
// Run: npm run import:pos -- path/to/export.xlsx [--dry-run]   (on the server: node --import tsx
//      --env-file=/opt/golden-grape/.env scripts/import-pos-products.mts <file>)
import { readFile, writeFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import type { Locale } from '@/lib/i18n';
import { parseDecimal } from '@/lib/money';
import { readTable, toCsv } from '@/lib/table';
import { indexesReady } from '@/lib/tx';
import { type CatalogueRow, type Column, importCatalogue, parseCatalogue, previewCatalogue } from '@/modules/catalogue/import';
import content from './seed-content.json';

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) {
  console.error('Usage: npm run import:pos -- path/to/export.xlsx [--dry-run]');
  process.exit(2);
}

type Vat = 'standard' | 'intermediate' | 'reduced' | 'superReduced';
type Target = { category: string; kind: 'wine' | 'grocery' | 'snack' | 'gift' | 'other'; vat: Vat; brand?: string; check?: string };
const wine = (brand?: string, check?: string): Target => ({ category: 'wines', kind: 'wine', vat: 'intermediate', brand, check });
const COUNTRY = 'country rubrique: check the producer and the country (the POS files some French wines under ITALIA)';
const RUBRIQUES: Record<string, Target> = {
  'QUINTA DO PÔPA': wine('Quinta do Pôpa'),
  'ANSELMO MENDES': wine('Anselmo Mendes'),
  'REAL CAVE DO CEDRO': wine('Real Cave do Cedro'),
  'JUSTINOS PROJECTS': wine('Justinos Projects'),
  'MONTE DA RAPOSINHA': wine('Monte da Raposinha'),
  'JOANA PINHAO WINE PROJECTS': wine('Joana Pinhao Wine Projects'),
  'HERDADE DA MAROTEIRA': wine('Herdade da Maroteira'),
  'QUINTA DA RAMALHOSA': wine('Quinta da Ramalhosa'),
  'QUINTA DA BASILIA': wine('Quinta da Basilia'),
  'QUINTA DOS LOIBOS': wine('Quinta dos Loibos'),
  'QUINTA DA PLANSEL': wine('Quinta da Plansel'),
  'TAPADA DE COELHEIROS': wine('Tapada de Coelheiros'),
  'JA TE DISSE': wine('Ja te Disse'),
  'ADEGA DO MONTADO': wine('Adega do Montado'),
  'ROSA DA MATA': wine('Rosa da Mata'),
  'VALE DOS ARES': wine('Vale dos Ares'),
  DESUSO: wine('Desuso'),
  LENHARDT: wine('Lenhardt'),
  'CHAMPAGNE GERBAUX': wine('Champagne Gerbaux'),
  FRANCE: wine(undefined, COUNTRY),
  ITALIA: wine(undefined, COUNTRY),
  AUTRICHE: wine(undefined, COUNTRY),
  LUXEMBURGO: wine(undefined, COUNTRY),
  "MARTHA'S": { category: 'port', kind: 'wine', vat: 'standard', brand: "Martha's", check: 'port category: move the DOC wines (and the aguardente) if needed' },
  SPIRITUEUX: { category: 'spirits', kind: 'other', vat: 'standard' },
  'MAISON VELVET': { category: 'spirits', kind: 'other', vat: 'standard', brand: 'Maison Velvet' },
  'SOFT DRINKS': { category: 'soft-drinks', kind: 'grocery', vat: 'superReduced' },
  EPICERIE: { category: 'grocery', kind: 'grocery', vat: 'superReduced' },
  TRICENTENAIRE: { category: 'grocery', kind: 'grocery', vat: 'superReduced', brand: 'Tricentenaire' },
  GADGETS: { category: 'accessories', kind: 'other', vat: 'standard' },
  'PETITE RESTAURATION': { category: 'counter', kind: 'snack', vat: 'superReduced' },
  'BOISSON CHAUDE': { category: 'counter', kind: 'snack', vat: 'superReduced' },
  'GOLDEN TASTE': { category: 'counter', kind: 'snack', vat: 'superReduced' },
  // Served items, beers and baskets mixed: split by name below.
  'AUTRES ARTICLES': { category: 'counter', kind: 'snack', vat: 'standard', check: 'counter item from AUTRES ARTICLES: publish on the Comptoir or archive' },
  'PRESTATION DE SERVICE': { category: 'counter', kind: 'snack', vat: 'standard' },
};
/** Till lines that are not products: fees, open-price lines, delivery charges, the gift cheque. Kept (archived) so every
 * POS id has its product; never sold online. */
const POS_ONLY = new Set(['divers vin', 'divers', 'digestif', 'droit de bouchon', 'livraison', 'livraison centre', 'livraison nord', 'livraison sud', 'service catering', 'cheque cadeau']);

/** A whole word or phrase, accents included (`\b` does not see "é" as a letter). */
const word = (...alternatives: string[]) => new RegExp(`(?<!\\p{L})(?:${alternatives.join('|')})(?!\\p{L})`, 'iu');
const COLOURS: [RegExp, string][] = [
  [word('porto', 'port', 'moscatel', 'madeira', 'aguardente', 'rainwater', 'lbv', 'tawny', '\\d+ anos'), 'fortified'],
  [word('champagne', 'cr[ée]mant', 'espumante', 'brut', 'sparkling', 'prosecco'), 'sparkling'],
  [word('ros[ée]', 'rosado', 'chiaretto'), 'rose'],
  [word('branco', 'blanc', 'white', 'bianco', 'riesling', 'alvarinho', 'encruzado', 'arinto', 'verdelho', 'sauvignon', 'chardonnay', 'fern[aã]o pires', 'lugana', 'gros manseng'), 'white'],
  [word('tinto', 'rouge', 'red', 'rosso', 'pinot noir', 'amarone', 'valpolicella', 'primitivo', 'touriga', 'alicante bouschet', 'bardolino'), 'red'],
];

type Review = { pos_id: string; rubrique: string; name: string; category: string; producer: string; kind: string; vat_class: string; price_eur: string; status: string; barcode: string; flags: string[]; photo_url: string };

/** One POS line → a catalogue record (template columns as text) and what staff should check. */
function convert(raw: Record<string, string>) {
  const rubrique = raw.Rubrique;
  const name = raw['Libellé'];
  const flags: string[] = [];
  let target = RUBRIQUES[rubrique];
  if (!target) {
    flags.push(`unknown rubrique "${rubrique}": filed in Épicerie`);
    target = { category: 'grocery', kind: 'grocery', vat: 'superReduced' };
  }
  const posOnly = rubrique === 'PRESTATION DE SERVICE' || POS_ONLY.has(name.trim().toLowerCase());
  if (posOnly) flags.push('POS-only line (fee, open price or service): imported archived');
  else if (rubrique === 'AUTRES ARTICLES' && /battin/i.test(name)) target = { category: 'beers', kind: 'other', vat: 'standard' };
  else if (rubrique === 'AUTRES ARTICLES' && /^(panier|boite à bouteille|accessoire)/i.test(name)) target = { category: 'accessories', kind: 'other', vat: 'standard' };
  else if (target.check) flags.push(target.check);

  const tokens = raw['Codes barre'].split(/[\s,;]+/).filter(Boolean);
  const codes = tokens.filter((t) => /^\d{8,14}$/.test(t));
  const extra = tokens.filter((t) => t !== codes[0]);
  if (extra.length) flags.push(`more in the barcode cell, not imported: ${extra.join(' ')}`);

  const posPrice = Boolean(raw['GOLDEN GRAPE']);
  let price = raw['GOLDEN GRAPE'];
  if (!posPrice) {
    flags.push('no price in the POS: imported at 0 €');
    price = '0';
  } else if (Number(price) === 0) flags.push('0 € in the POS');

  const letters = name.replace(/[^\p{L}]/gu, '');
  if (letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase())) flags.push('name in a single case');
  if (/\(\d+\)\s*$/.test(name)) flags.push('looks like a duplicate in the POS ("(1)")');

  const isWine = target.kind === 'wine';
  const colour = isWine ? (COLOURS.find(([re]) => re.test(name))?.[1] ?? '') : '';
  const vintage = isWine ? (name.match(/(?<!\d)(19[5-9]\d|20[0-3]\d)(?!\d)/)?.[1] ?? '') : '';
  const record: Partial<Record<Column, string>> = {
    sku: raw['#ID'],
    barcode: codes[0] ?? '',
    name_fr: name,
    kind: posOnly ? 'snack' : target.kind,
    category_slug: posOnly ? 'counter' : target.category,
    brand: posOnly ? '' : (target.brand ?? ''),
    colour,
    vintage,
    vat_class: target.vat,
    price_eur: price,
    cost_eur: raw['Coût de revient HT'],
    status: posOnly ? 'archived' : '',
  };
  const review: Review = {
    pos_id: raw['#ID'],
    rubrique,
    name,
    category: record.category_slug ?? '',
    producer: record.brand ?? '',
    kind: record.kind ?? '',
    vat_class: target.vat,
    price_eur: (parseDecimal(price) / 100).toFixed(2).replace('.', ','),
    status: posOnly ? 'archived' : 'draft',
    barcode: codes[0] ?? '',
    flags,
    photo_url: raw['URL image'],
  };
  return { record, review, posPrice };
}

const lines: string[] = [];
const log = (message: string) => {
  lines.push(message);
  console.info(message);
};

const table = await readTable(await readFile(file), file);
for (const column of ['Rubrique', 'Libellé', 'Codes barre', '#ID', 'Coût de revient HT', 'GOLDEN GRAPE']) {
  if (!table.headers.includes(column)) throw new Error(`${file}: column "${column}" missing; is this the POS product export?`);
}
const converted = table.rows.map((raw) => (raw['#ID'] ? convert(raw) : undefined));
const records = converted.map((c) => c?.record ?? {});
const parsed = parseCatalogue({ headers: Object.keys(records.find((r) => r.sku) ?? {}), rows: records as Record<string, string>[] });

// Dynamic import: payload.config.ts compiles as CommonJS (see scripts/seed.mts).
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
await indexesReady(payload);

// A re-run: products already imported keep their review; only the price, the cost and a missing barcode follow the POS.
const { docs: existing } = await payload.find({ collection: 'variants', where: { sku: { in: parsed.rows.flatMap((r) => (r.sku ? [r.sku] : [])) } }, limit: 0, depth: 0, overrideAccess: true, select: { sku: true, barcode: true } });
const known = new Map(existing.map((v) => [v.sku, v]));
const rows: CatalogueRow[] = parsed.rows.map((row) => {
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined));
  const variant = known.get(row.sku as string);
  if (!variant) return out as CatalogueRow;
  const posPrice = converted[(row.row as number) - 2]?.posPrice;
  return { row: row.row, sku: row.sku, ...(posPrice ? { price_eur: row.price_eur } : {}), ...(row.cost_eur !== null ? { cost_eur: row.cost_eur } : {}), ...(row.barcode && !variant.barcode ? { barcode: row.barcode } : {}) };
});

// Categories the mapping needs: created when missing (names in 4 languages from the seed), never renamed.
const LOCALES: Locale[] = ['fr', 'en', 'de', 'pt'];
const order = [...Object.keys(content.fr.catalogue.categories), 'counter'];
const label = (slug: string, l: Locale) => (slug === 'counter' ? content[l].catalogue.counter : (content[l].catalogue.categories as Record<string, string>)[slug]);
const needed = [...new Set(rows.flatMap((r) => (r.category_slug ? [r.category_slug] : [])))];
const { docs: present } = await payload.find({ collection: 'categories', where: { slug: { in: needed } }, limit: 0, depth: 0, overrideAccess: true, select: { slug: true } });
const missing = needed.filter((slug) => !present.some((c) => c.slug === slug));
if (!dryRun) {
  for (const slug of missing) {
    const created = await payload.create({ collection: 'categories', data: { name: label(slug, 'fr'), slug, kind: slug === 'counter' ? 'snack' : 'shop', order: order.indexOf(slug) + 1 }, locale: 'fr', overrideAccess: true });
    for (const l of LOCALES.slice(1)) await payload.update({ collection: 'categories', id: created.id, data: { name: label(slug, l) }, locale: l, overrideAccess: true });
  }
}

const preview = await previewCatalogue(payload, rows);
// In a dry run the missing categories do not exist yet: their "no category" errors are expected.
const errors = [...parsed.errors, ...preview.errors.filter((e) => !(dryRun && e.column === 'category_slug' && missing.some((slug) => e.message === `no category "${slug}"`)))];
const stamp = new Date().toISOString();
log(`[pos-import] ${stamp} ${file}: ${parsed.rows.length} POS products, ${preview.create} new, ${preview.update} already imported${dryRun ? ' (dry run, nothing written)' : ''}`);
if (missing.length) log(`[pos-import] categories ${dryRun ? 'to create' : 'created'}: ${missing.join(', ')}`);
if (errors.length) {
  log(`[pos-import] ${errors.length} error(s), nothing was written`);
  for (const e of errors.sort((a, b) => a.row - b.row)) log(`  row ${e.row} · ${e.column}: ${e.message}`);
} else if (!dryRun) {
  const result = await importCatalogue(payload, rows, { newStatus: 'draft' });
  log(`[pos-import] ${result.created} created (drafts, POS-only lines archived), ${result.updated} updated`);
}

const reviews = converted.filter((c) => c !== undefined).map((c) => ({ ...c.review, status: known.has(c.review.pos_id) ? 'already imported' : c.review.status }));
const columns = ['pos_id', 'rubrique', 'name', 'category', 'producer', 'kind', 'vat_class', 'price_eur', 'status', 'barcode', 'flags', 'photo_url'] as const;
await writeFile(`${file}.review.csv`, toCsv([...columns], reviews.map((r) => columns.map((c) => (c === 'flags' ? r.flags.join(' · ') : r[c])))));
const byCategory = Object.entries(Object.groupBy(reviews, (r) => r.category)).map(([k, v]) => `${k} ${v?.length}`);
log(`[pos-import] by category: ${byCategory.join(', ')}; ${reviews.filter((r) => r.flags.length).length} lines with something to check → ${file}.review.csv`);
await writeFile(`${file}.log`, `${lines.join('\n')}\n`, { flag: 'a' });
await payload.destroy();
process.exit(errors.length ? 1 : 0);
