import Papa from 'papaparse';
import type { Payload } from 'payload';
import { z } from 'zod';
import type { Label } from '@/lib/admin';
import type { Locale } from '@/lib/i18n';
import { parseDecimal } from '@/lib/money';
import { type Tx, withTx } from '@/lib/tx';
import { hasMovements, postMovements, setLowStockThreshold } from '@/modules/inventory/service';
import { PRODUCT_KINDS, VAT_CLASSES, WINE_COLOURS } from './collections';

// Catalogue import (M2.1 T6, DEP-04): the client's spreadsheet exported as CSV, upserted by `sku`. Every row is
// validated before anything is written; one invalid row means nothing is written. The seed uses importCatalogue too.

export const TEMPLATE_COLUMNS = [
  'sku', 'barcode', 'name_fr', 'name_en', 'name_de', 'name_pt', 'kind', 'category_slug', 'brand', 'region_fr', 'vintage', 'colour',
  'vat_class', 'price_eur', 'cost_eur', 'box6_barcode', 'box6_price_eur', 'box12_barcode', 'box12_price_eur', 'supplier', 'supplier_ref',
  'opening_stock', 'low_stock',
] as const;

const text = z.string().trim();
const optional = text.transform((v) => v || undefined);
const barcode = optional.refine((v) => v === undefined || /^\d{4,14}$/.test(v), 'digits only (4 to 14)');
const euros = (required: boolean) =>
  text.transform((v, ctx) => {
    if (!v) {
      if (required) ctx.addIssue({ code: 'custom', message: 'required' });
      return undefined;
    }
    const cents = parseDecimal(v);
    if (Number.isNaN(cents) || cents < 0) ctx.addIssue({ code: 'custom', message: `"${v}" is not an amount in euros` });
    return cents;
  });
const count = optional.transform((v, ctx) => {
  if (v === undefined) return undefined;
  if (!/^\d+$/.test(v)) ctx.addIssue({ code: 'custom', message: `"${v}" is not a whole number ≥ 0` });
  return Number(v);
});
const oneOf = <T extends readonly [string, ...string[]]>(values: T) => text.pipe(z.enum(values, { error: `must be one of ${values.join(', ')}` }));

const rowSchema = z.object({
  sku: text.min(1, 'required'),
  barcode,
  name_fr: text.min(1, 'required'),
  name_en: optional,
  name_de: optional,
  name_pt: optional,
  kind: oneOf(PRODUCT_KINDS),
  category_slug: text.min(1, 'required'),
  brand: optional,
  region_fr: optional,
  vintage: count,
  colour: optional.pipe(z.enum(WINE_COLOURS, { error: `must be one of ${WINE_COLOURS.join(', ')}` }).optional()),
  vat_class: oneOf(VAT_CLASSES),
  price_eur: euros(true),
  cost_eur: euros(false),
  box6_barcode: barcode,
  box6_price_eur: euros(false),
  box12_barcode: barcode,
  box12_price_eur: euros(false),
  supplier: optional,
  supplier_ref: optional,
  opening_stock: count,
  low_stock: count,
});

/** A validated row, plus its spreadsheet row number and what only the seed provides (fixed slug, description,
 * photos, badges). */
export type CatalogueRow = z.output<typeof rowSchema> & {
  row?: number;
  slug?: string;
  description?: Partial<Record<Locale, unknown>>;
  images?: string[];
  badges?: string[];
};
export type RowError = { row: number; column: string; message: string };

/** Spreadsheet row number of the i-th data row (row 1 is the header). */
const rowNumber = (i: number) => i + 2;

/** Parses the CSV and checks each row's format. Errors carry the spreadsheet row number. */
export function parseCatalogueCsv(csv: string): { rows: CatalogueRow[]; errors: RowError[] } {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  const missing = TEMPLATE_COLUMNS.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) return { rows: [], errors: [{ row: 1, column: missing.join(', '), message: 'missing column' }] };
  const errors: RowError[] = parsed.errors.map((e) => ({ row: rowNumber(e.row ?? 0), column: '-', message: e.message }));
  const rows: CatalogueRow[] = [];
  parsed.data.forEach((raw, i) => {
    const result = rowSchema.safeParse(Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, raw[c] ?? ''])));
    if (result.success) rows.push({ ...result.data, row: rowNumber(i) });
    else for (const issue of result.error.issues) errors.push({ row: rowNumber(i), column: String(issue.path[0] ?? '-'), message: issue.message });
  });
  return { rows, errors };
}

/** Checks the rows against each other and the database: categories exist, barcodes are unique across the file and
 * belong to nobody else (a variant or box of another sku). Nothing is written. */
export async function validateCatalogue(payload: Payload, rows: CatalogueRow[]): Promise<RowError[]> {
  const errors: RowError[] = [];
  const { docs: categories } = await payload.find({ collection: 'categories', limit: 0, depth: 0, overrideAccess: true, select: { slug: true, kind: true } });
  const categoryKind = new Map(categories.map((c) => [c.slug, c.kind]));
  const skus = new Map<string, number>();
  const codes = new Map<string, number>();

  for (const [i, row] of rows.entries()) {
    const n = row.row ?? rowNumber(i);
    if (skus.has(row.sku)) errors.push({ row: n, column: 'sku', message: `same sku as row ${skus.get(row.sku)}` });
    skus.set(row.sku, n);

    const kind = categoryKind.get(row.category_slug);
    if (!kind) errors.push({ row: n, column: 'category_slug', message: `no category "${row.category_slug}"` });
    else if ((kind === 'snack') !== (row.kind === 'snack')) errors.push({ row: n, column: 'category_slug', message: `"${row.category_slug}" is a ${kind} category, the product is ${row.kind}` });

    for (const column of ['barcode', 'box6_barcode', 'box12_barcode'] as const) {
      const code = row[column];
      if (!code) continue;
      if (codes.has(code)) errors.push({ row: n, column, message: `barcode ${code} already used in row ${codes.get(code)}` });
      codes.set(code, n);
      const [variant, unit] = await Promise.all([
        payload.find({ collection: 'variants', where: { barcode: { equals: code } }, limit: 1, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'packagingUnits', where: { barcode: { equals: code } }, limit: 1, depth: 1, overrideAccess: true }),
      ]);
      const owner = variant.docs[0]?.sku ?? (typeof unit.docs[0]?.variant === 'object' ? unit.docs[0].variant.sku : undefined);
      if (owner && owner !== row.sku) errors.push({ row: n, column, message: `barcode ${code} belongs to sku ${owner}` });
    }
  }
  return errors;
}

const OTHERS: Locale[] = ['en', 'de', 'pt'];
const BOX: Record<6 | 12, Label> = {
  6: { fr: 'Carton de 6', en: 'Box of 6', de: '6er-Karton', pt: 'Caixa de 6' },
  12: { fr: 'Carton de 12', en: 'Box of 12', de: '12er-Karton', pt: 'Caixa de 12' },
};

async function upsertRow(tx: Tx, row: CatalogueRow, categoryId: string) {
  const { req } = tx;
  const { payload } = req;
  const opts = { req, overrideAccess: true, depth: 0 } as const;
  const names: Record<Locale, string | undefined> = { fr: row.name_fr, en: row.name_en, de: row.name_de, pt: row.name_pt };

  let brand: string | undefined;
  if (row.brand) {
    const found = await payload.find({ collection: 'brands', where: { name: { equals: row.brand } }, limit: 1, ...opts });
    brand = found.docs[0]?.id ?? (await payload.create({ collection: 'brands', data: { name: row.brand } as never, ...opts })).id; // slug: autoSlug
  }

  const product = {
    name: row.name_fr,
    kind: row.kind,
    category: categoryId,
    brand,
    vatClass: row.vat_class,
    ...(row.kind === 'wine' ? { wine: { region: row.region_fr, vintage: row.vintage, colour: row.colour } } : {}),
    ...(row.badges ? { badges: row.badges as never } : {}),
    ...(row.images ? { images: row.images } : {}),
    ...(row.description?.fr ? { description: row.description.fr as never } : {}),
  };
  const variantData = { priceCents: row.price_eur as number, costCents: row.cost_eur, barcode: row.barcode ?? null, trackStock: row.kind !== 'snack' };

  const existing = await payload.find({ collection: 'variants', where: { sku: { equals: row.sku } }, limit: 1, ...opts });
  let variant = existing.docs[0];
  let productId: string;
  if (variant) {
    productId = typeof variant.product === 'object' ? variant.product.id : variant.product;
    await payload.update({ collection: 'products', id: productId, data: product, locale: 'fr', ...opts });
    variant = await payload.update({ collection: 'variants', id: variant.id, data: { ...variantData, label: row.name_fr }, locale: 'fr', ...opts });
  } else {
    const created = await payload.create({
      collection: 'products',
      data: { ...product, slug: row.slug as string, status: 'active', firstVariant: { sku: row.sku, barcode: row.barcode, priceCents: row.price_eur, costCents: row.cost_eur } } as never,
      locale: 'fr',
      ...opts,
    });
    productId = created.id;
    const { docs } = await payload.find({ collection: 'variants', where: { sku: { equals: row.sku } }, limit: 1, ...opts });
    variant = docs[0];
  }

  for (const l of OTHERS) {
    const name = names[l];
    const description = row.description?.[l];
    if (!name && !description) continue;
    await payload.update({ collection: 'products', id: productId, data: { ...(name ? { name } : {}), ...(description ? { description: description as never } : {}) }, locale: l, ...opts });
    if (name) await payload.update({ collection: 'variants', id: variant.id, data: { label: name }, locale: l, ...opts });
  }

  for (const factor of [6, 12] as const) {
    const code = row[`box${factor}_barcode`];
    const price = row[`box${factor}_price_eur`];
    if (code === undefined && price === undefined) continue;
    const found = await payload.find({ collection: 'packagingUnits', where: { variant: { equals: variant.id }, factor: { equals: factor } }, limit: 1, ...opts });
    const data = { variant: variant.id, factor, label: BOX[factor].fr, barcode: code ?? null, priceCents: price ?? null };
    const unit = found.docs[0]
      ? await payload.update({ collection: 'packagingUnits', id: found.docs[0].id, data, locale: 'fr', ...opts })
      : await payload.create({ collection: 'packagingUnits', data, locale: 'fr', ...opts });
    for (const l of OTHERS) await payload.update({ collection: 'packagingUnits', id: unit.id, data: { label: BOX[factor][l] }, locale: l, ...opts });
  }

  if (row.kind !== 'snack') {
    if (row.low_stock !== undefined) await setLowStockThreshold(tx, variant.id, row.low_stock);
    if (row.opening_stock && !(await hasMovements(req, { variants: [variant.id] }))) {
      await postMovements(tx, [{ variant: variant.id, unitQty: row.opening_stock, type: 'adjustment', reason: 'opening stock', channel: 'backoffice' }]);
    }
  }
  return existing.docs.length ? ('updated' as const) : ('created' as const);
}

/**
 * Validates every row, then upserts them one transaction per row. With any error, nothing is written and the
 * errors are returned. Opening stock is posted once, as one `adjustment` movement, only for a variant with no movement.
 */
export async function importCatalogue(payload: Payload, rows: CatalogueRow[]) {
  const errors = await validateCatalogue(payload, rows);
  if (errors.length) return { errors, created: 0, updated: 0 };
  const { docs: categories } = await payload.find({ collection: 'categories', limit: 0, depth: 0, overrideAccess: true, select: { slug: true } });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));
  const result = { errors, created: 0, updated: 0 };
  for (const row of rows) {
    const outcome = await withTx(payload, (tx) => upsertRow(tx, row, categoryId.get(row.category_slug) as string));
    result[outcome] += 1;
  }
  return result;
}
