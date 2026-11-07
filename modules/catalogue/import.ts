import type { Payload } from 'payload';
import { z } from 'zod';
import type { Label } from '@/lib/admin';
import { LOCALES, type Locale } from '@/lib/i18n';
import { parseDecimal } from '@/lib/money';
import { fromPlainText } from '@/lib/rich-text';
import type { Table } from '@/lib/table';
import { type Tx, withTx } from '@/lib/tx';
import { hasMovements, postMovements, setLowStockThreshold } from '@/modules/inventory/service';
import { PRODUCT_KINDS, PRODUCT_STATUSES, VAT_CLASSES, WINE_COLOURS } from './collections';

// Catalogue import (M2.1 T6, DEP-04): a spreadsheet (CSV or XLSX, see lib/table.ts) upserted by `sku`, else by
// barcode. Every row is checked before anything is written; one invalid row means nothing is written. A column the
// file does not have leaves that field as it is; an empty cell in a column it has clears the field. The seed, the
// CLI, the POS product import and the back-office page all go through importCatalogue.

export const TEMPLATE_COLUMNS = [
  'sku', 'barcode', 'name_fr', 'name_en', 'name_de', 'name_pt', 'kind', 'category_slug', 'brand', 'region_fr', 'vintage', 'colour',
  'vat_class', 'price_eur', 'cost_eur', 'box6_barcode', 'box6_price_eur', 'box12_barcode', 'box12_price_eur', 'supplier', 'supplier_ref',
  'opening_stock', 'low_stock', 'status', 'description_fr', 'description_en', 'description_de', 'description_pt',
] as const;
export type Column = (typeof TEMPLATE_COLUMNS)[number];
const OTHERS = LOCALES.filter((l) => l !== 'fr');
/** What a new product needs. An existing product may leave them out; an empty cell there also means "unchanged". */
const CREATE_COLUMNS = ['name_fr', 'kind', 'category_slug', 'vat_class', 'price_eur'] as const;

const text = z.string().trim();
/** Empty cell → null: the field is cleared. */
const clearable = text.transform((v) => v || null);
/** Empty cell → undefined: the field keeps its value (required fields, which cannot be cleared). */
const kept = text.transform((v) => v || undefined);
const barcode = clearable.refine((v) => v === null || /^\d{4,14}$/.test(v), 'digits only (4 to 14)');
const euros = <T extends null | undefined>(empty: T) =>
  text.transform((v, ctx) => {
    if (!v) return empty;
    const cents = parseDecimal(v);
    if (Number.isNaN(cents) || cents < 0) ctx.addIssue({ code: 'custom', message: `"${v}" is not an amount in euros` });
    return cents;
  });
const count = clearable.transform((v, ctx) => {
  if (v === null) return null;
  if (!/^\d+$/.test(v)) ctx.addIssue({ code: 'custom', message: `"${v}" is not a whole number ≥ 0` });
  return Number(v);
});
const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  kept.pipe(z.enum(values, { error: `must be one of ${values.join(', ')}` }).optional());

const rowSchema = z
  .object({
    sku: kept,
    barcode,
    name_fr: kept,
    name_en: kept,
    name_de: kept,
    name_pt: kept,
    kind: oneOf(PRODUCT_KINDS),
    category_slug: kept,
    brand: clearable,
    region_fr: clearable,
    vintage: count,
    colour: clearable.pipe(z.enum(WINE_COLOURS, { error: `must be one of ${WINE_COLOURS.join(', ')}` }).nullable()),
    vat_class: oneOf(VAT_CLASSES),
    price_eur: euros(undefined),
    cost_eur: euros(null),
    box6_barcode: barcode,
    box6_price_eur: euros(null),
    box12_barcode: barcode,
    box12_price_eur: euros(null),
    supplier: clearable,
    supplier_ref: clearable,
    opening_stock: count,
    low_stock: count,
    status: oneOf(PRODUCT_STATUSES),
    description_fr: text,
    description_en: text,
    description_de: text,
    description_pt: text,
  })
  .partial();

/** A checked row: a key the file does not have is `undefined` (unchanged); `null` clears. Plus its spreadsheet row
 * number and what only the seed provides (fixed slug, photos, badges, rich-text descriptions). */
export type CatalogueRow = Omit<z.output<typeof rowSchema>, `description_${Locale}`> & {
  row?: number;
  slug?: string;
  description?: Partial<Record<Locale, unknown>>;
  images?: string[];
  badges?: string[];
};
export type RowError = { row: number; column: string; message: string };

/** Checks each row's format. Unknown columns are ignored; blank rows are skipped. Row numbers are the spreadsheet's. */
export function parseCatalogue(table: Table): { rows: CatalogueRow[]; errors: RowError[] } {
  const present = TEMPLATE_COLUMNS.filter((c) => table.headers.includes(c));
  if (!present.includes('sku') && !present.includes('barcode')) {
    return { rows: [], errors: [{ row: 1, column: 'sku, barcode', message: 'a sku or a barcode column is needed to find the products again' }] };
  }
  const rows: CatalogueRow[] = [];
  const errors: RowError[] = [];
  table.rows.forEach((raw, i) => {
    const row = i + 2;
    if (present.every((c) => !raw[c]?.trim())) return;
    const result = rowSchema.safeParse(Object.fromEntries(present.map((c) => [c, raw[c] ?? ''])));
    if (!result.success) {
      for (const issue of result.error.issues) errors.push({ row, column: String(issue.path[0] ?? '-'), message: issue.message });
      return;
    }
    const { description_fr, description_en, description_de, description_pt, ...fields } = result.data;
    const texts = { fr: description_fr, en: description_en, de: description_de, pt: description_pt };
    const description = Object.fromEntries(LOCALES.filter((l) => texts[l] !== undefined).map((l) => [l, fromPlainText(texts[l] as string)]));
    rows.push({ ...fields, ...(Object.keys(description).length ? { description } : {}), row });
  });
  return { rows, errors };
}

/** The existing size a row updates, its product, and the languages that product already has a name in. */
type Match = { variant: string; product: string; kind: string; category: string; named: Locale[] };

/** Checks the rows against each other and the database, and finds the existing size each row updates (by sku, else
 * by barcode). Categories exist and fit the kind; a new product has its required fields; barcodes are unique in the
 * file and belong to nobody else (a size or box of another product). Nothing is written. */
async function check(payload: Payload, rows: CatalogueRow[]): Promise<{ errors: RowError[]; matches: (Match | undefined)[] }> {
  const opts = { limit: 0, depth: 0, overrideAccess: true } as const;
  const errors: RowError[] = [];
  const codeColumns = ['barcode', 'box6_barcode', 'box12_barcode'] as const;
  const skus = rows.flatMap((r) => (r.sku ? [r.sku] : []));
  const codes = rows.flatMap((r) => codeColumns.flatMap((c) => (r[c] ? [r[c]] : [])));

  const [{ docs: categories }, { docs: variants }, { docs: units }] = await Promise.all([
    payload.find({ collection: 'categories', ...opts, select: { slug: true, kind: true } }),
    payload.find({ collection: 'variants', ...opts, where: { or: [{ sku: { in: skus } }, { barcode: { in: codes } }] }, select: { sku: true, barcode: true, product: true } }),
    payload.find({ collection: 'packagingUnits', ...opts, where: { barcode: { in: codes } }, select: { barcode: true, variant: true } }),
  ]);
  const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: string }).id : String(v));
  const { docs: owners } = await payload.find({ collection: 'variants', ...opts, where: { id: { in: units.map((u) => idOf(u.variant)) } }, select: { sku: true } });
  const { docs: products } = await payload.find({ collection: 'products', ...opts, locale: 'all', where: { id: { in: variants.map((v) => idOf(v.product)) } }, select: { name: true, kind: true, category: true } });

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const categoryKind = new Map(categories.map((c) => [c.id, c.kind]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const skuOf = new Map([...variants, ...owners].map((v) => [v.id, v.sku]));
  const match = (v: (typeof variants)[number] | undefined): Match | undefined => {
    const product = v && productById.get(idOf(v.product));
    const names = (product?.name ?? {}) as unknown as Partial<Record<Locale, string>>;
    return v && product ? { variant: v.id, product: product.id, kind: product.kind, category: idOf(product.category), named: LOCALES.filter((l) => names[l]) } : undefined;
  };
  const bySku = new Map(variants.map((v) => [v.sku, v]));
  const byBarcode = new Map(variants.filter((v) => v.barcode).map((v) => [v.barcode as string, v]));
  const codeOwner = new Map<string, string>([...units.map((u) => [u.barcode as string, idOf(u.variant)] as const), ...[...byBarcode].map(([code, v]) => [code, v.id] as const)]);

  const seenSku = new Map<string, number>();
  const seenCode = new Map<string, number>();
  const matches = rows.map((row, i) => {
    const n = row.row ?? i + 2;
    if (row.sku) {
      if (seenSku.has(row.sku)) errors.push({ row: n, column: 'sku', message: `same sku as row ${seenSku.get(row.sku)}` });
      seenSku.set(row.sku, n);
    }
    if (!row.sku && !row.barcode) errors.push({ row: n, column: 'sku', message: 'a sku or a barcode is needed to find the product again' });
    const found = match(row.sku ? bySku.get(row.sku) : row.barcode ? byBarcode.get(row.barcode) : undefined);

    if (!found) for (const column of CREATE_COLUMNS) if (row[column] === undefined) errors.push({ row: n, column, message: 'required to create a product' });

    const category = row.category_slug === undefined ? undefined : categoryBySlug.get(row.category_slug);
    if (row.category_slug !== undefined && !category) errors.push({ row: n, column: 'category_slug', message: `no category "${row.category_slug}"` });
    const kind = row.kind ?? found?.kind;
    const categoryKindNow = category?.kind ?? (found ? categoryKind.get(found.category) : undefined);
    if (kind && categoryKindNow && (categoryKindNow === 'snack') !== (kind === 'snack')) {
      errors.push({ row: n, column: row.category_slug !== undefined ? 'category_slug' : 'kind', message: `the category is a ${categoryKindNow} category, the product is ${kind}` });
    }

    // Payload refuses a language with a description but no name: the name comes with it, or is already there.
    for (const l of OTHERS) {
      if (row.description?.[l] && !row[`name_${l}`] && !found?.named.includes(l)) errors.push({ row: n, column: `name_${l}`, message: `needed with description_${l}` });
    }

    for (const column of codeColumns) {
      const code = row[column];
      if (!code) continue;
      if (seenCode.has(code)) errors.push({ row: n, column, message: `barcode ${code} already used in row ${seenCode.get(code)}` });
      seenCode.set(code, n);
      const owner = codeOwner.get(code);
      if (owner && owner !== found?.variant) errors.push({ row: n, column, message: `barcode ${code} belongs to sku ${skuOf.get(owner)}` });
    }
    return found;
  });
  return { errors, matches };
}

/** The checks of importCatalogue without writing: errors, and how many products would be created or updated. */
export async function previewCatalogue(payload: Payload, rows: CatalogueRow[]) {
  const { errors, matches } = await check(payload, rows);
  return { errors, create: matches.filter((m) => !m).length, update: matches.filter(Boolean).length };
}

const BOX: Record<6 | 12, Label> = {
  6: { fr: 'Carton de 6', en: 'Box of 6', de: '6er-Karton', pt: 'Caixa de 6' },
  12: { fr: 'Carton de 12', en: 'Box of 12', de: '12er-Karton', pt: 'Caixa de 12' },
};
/** The keys of `data` whose value is not undefined (undefined = "the file does not say"). */
const given = <T extends Record<string, unknown>>(data: T) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;

async function upsertRow(tx: Tx, row: CatalogueRow, found: Match | undefined, categoryId: Map<string, string>, newStatus: (typeof PRODUCT_STATUSES)[number]) {
  const { req } = tx;
  const { payload } = req;
  const opts = { req, overrideAccess: true, depth: 0 } as const;

  let brand: string | null | undefined = row.brand === null ? null : undefined;
  if (row.brand) {
    const existing = await payload.find({ collection: 'brands', where: { name: { equals: row.brand } }, limit: 1, ...opts });
    brand = existing.docs[0]?.id ?? (await payload.create({ collection: 'brands', data: { name: row.brand } as never, ...opts })).id; // slug: autoSlug
  }
  const wine = given({ region: row.region_fr, vintage: row.vintage, colour: row.colour });
  const product = given({
    name: row.name_fr,
    kind: row.kind,
    category: row.category_slug === undefined ? undefined : categoryId.get(row.category_slug),
    brand,
    vatClass: row.vat_class,
    status: row.status,
    wine: Object.keys(wine).length ? wine : undefined,
    badges: row.badges,
    images: row.images,
    description: row.description?.fr,
  });

  let productId: string;
  let variantId: string;
  if (found) {
    productId = found.product;
    variantId = found.variant;
    if (Object.keys(product).length) await payload.update({ collection: 'products', id: productId, data: product as never, locale: 'fr', ...opts });
    const trackStock = row.kind === undefined ? undefined : row.kind !== 'snack';
    const variant = given({ label: row.name_fr, priceCents: row.price_eur, costCents: row.cost_eur, barcode: row.barcode, trackStock });
    if (Object.keys(variant).length) await payload.update({ collection: 'variants', id: variantId, data: variant as never, locale: 'fr', ...opts });
  } else {
    const created = await payload.create({
      collection: 'products',
      data: { status: newStatus, ...product, slug: row.slug, firstVariant: given({ sku: row.sku, barcode: row.barcode ?? undefined, priceCents: row.price_eur, costCents: row.cost_eur ?? undefined }) } as never,
      locale: 'fr',
      ...opts,
    });
    productId = created.id;
    variantId = (await payload.find({ collection: 'variants', where: { product: { equals: productId } }, limit: 1, ...opts })).docs[0].id;
  }

  for (const l of OTHERS) {
    // A translation cannot be emptied here (the name is required in every language Payload validates): skipped.
    const name = row[`name_${l}`] ?? undefined;
    const named = Boolean(name) || Boolean(found?.named.includes(l));
    const data = given({ name, description: named ? row.description?.[l] : undefined });
    if (!Object.keys(data).length) continue;
    await payload.update({ collection: 'products', id: productId, data: data as never, locale: l, ...opts });
    if (name) await payload.update({ collection: 'variants', id: variantId, data: { label: name }, locale: l, ...opts });
  }

  for (const factor of [6, 12] as const) {
    const code = row[`box${factor}_barcode`];
    const price = row[`box${factor}_price_eur`];
    if (code === undefined && price === undefined) continue;
    const existing = (await payload.find({ collection: 'packagingUnits', where: { variant: { equals: variantId }, factor: { equals: factor } }, limit: 1, ...opts })).docs[0];
    if (existing) {
      await payload.update({ collection: 'packagingUnits', id: existing.id, data: given({ barcode: code, priceCents: price }), locale: 'fr', ...opts });
    } else if (code || price) {
      const unit = await payload.create({ collection: 'packagingUnits', data: { variant: variantId, factor, label: BOX[factor].fr, barcode: code, priceCents: price }, locale: 'fr', ...opts });
      for (const l of OTHERS) await payload.update({ collection: 'packagingUnits', id: unit.id, data: { label: BOX[factor][l] }, locale: l, ...opts });
    }
  }

  if ((row.kind ?? found?.kind) !== 'snack') {
    if (row.low_stock !== undefined) await setLowStockThreshold(tx, variantId, row.low_stock);
    if (row.opening_stock && !(await hasMovements(req, { variants: [variantId] }))) {
      await postMovements(tx, [{ variant: variantId, unitQty: row.opening_stock, type: 'adjustment', reason: 'opening stock', channel: 'backoffice' }]);
    }
  }
  return found ? ('updated' as const) : ('created' as const);
}

/**
 * Checks every row, then upserts rows `from`..`to` (default: all), one transaction per row. With any error, nothing
 * is written and the errors are returned. New products get `newStatus` unless the row has a status: `draft` by
 * default, so an import is reviewed before it is sold. Opening stock is posted once, as one `adjustment`, only for a
 * size with no movement.
 */
export async function importCatalogue(
  payload: Payload,
  rows: CatalogueRow[],
  { newStatus = 'draft', from = 0, to = rows.length }: { newStatus?: (typeof PRODUCT_STATUSES)[number]; from?: number; to?: number } = {},
) {
  const { errors, matches } = await check(payload, rows);
  const result = { errors, created: 0, updated: 0 };
  if (errors.length) return result;
  const { docs: categories } = await payload.find({ collection: 'categories', limit: 0, depth: 0, overrideAccess: true, select: { slug: true } });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));
  for (let i = from; i < Math.min(to, rows.length); i++) {
    result[await withTx(payload, (tx) => upsertRow(tx, rows[i], matches[i], categoryId, newStatus))] += 1;
  }
  return result;
}
