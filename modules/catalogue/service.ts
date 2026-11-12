import type { Payload, PayloadRequest, Where } from 'payload';
import type { Locale } from '@/lib/i18n';
import { model } from '@/lib/tx';
import type { CHANNELS } from './collections';

type Channel = (typeof CHANNELS)[number];
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === 'object' && value ? value.id : (value ?? undefined));

/** What the stock ledger needs to know about variants and packaging units (inventory.postMovements, availability). */
export async function stockRules({ payload, req }: { payload: Payload; req?: PayloadRequest }, variantIds: string[], unitIds: string[]) {
  // Sequential: with `req` this runs in the caller's transaction, whose session takes one operation at a time.
  const variants = await payload.find({ collection: 'variants', where: { id: { in: [...new Set(variantIds)] } }, limit: 0, depth: 0, req, overrideAccess: true, select: { trackStock: true } });
  const units = unitIds.length
    ? await payload.find({ collection: 'packagingUnits', where: { id: { in: [...new Set(unitIds)] } }, limit: 0, depth: 0, req, overrideAccess: true, select: { variant: true, factor: true } })
    : { docs: [] };
  return {
    variants: new Map(variants.docs.map((v) => [v.id, { trackStock: v.trackStock !== false }])),
    units: new Map(units.docs.map((u) => [u.id, { variant: idOf(u.variant), factor: u.factor }])),
  };
}

/** Many codes at once (a stock count from a file): sizes by sku, and by barcode with the box factor (a box's barcode
 * first, as findByBarcode). Each entry says whether the size tracks stock. */
export async function resolveCodes(payload: Payload, { skus, barcodes }: { skus: string[]; barcodes: string[] }) {
  const opts = { limit: 0, depth: 0, overrideAccess: true } as const;
  const [variants, units] = await Promise.all([
    payload.find({ collection: 'variants', ...opts, where: { or: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] }, select: { sku: true, barcode: true, trackStock: true, title: true } }),
    payload.find({ collection: 'packagingUnits', ...opts, where: { barcode: { in: barcodes } }, select: { barcode: true, variant: true, factor: true } }),
  ]);
  const boxVariants = await payload.find({ collection: 'variants', ...opts, where: { id: { in: units.docs.map((u) => idOf(u.variant) as string) } }, select: { trackStock: true, title: true } });
  const size = (v: { id: string; trackStock?: boolean | null; title?: string | null }, factor: number) => ({ variant: v.id, factor, tracked: v.trackStock !== false, title: v.title ?? '' });
  const byId = new Map([...variants.docs, ...boxVariants.docs].map((v) => [v.id, v]));
  const bySku = new Map(variants.docs.map((v) => [v.sku, size(v, 1)]));
  const byBarcode = new Map(variants.docs.filter((v) => v.barcode).map((v) => [v.barcode as string, size(v, 1)]));
  for (const u of units.docs) {
    const v = byId.get(idOf(u.variant) as string);
    if (v) byBarcode.set(u.barcode as string, size(v, u.factor));
  }
  return { bySku, byBarcode };
}

/** A scanned code: a packaging unit's barcode first (a box of 6 → factor 6), then a variant's (factor 1). */
export async function findByBarcode(payload: Payload, code: string) {
  const unit = await payload.find({ collection: 'packagingUnits', where: { barcode: { equals: code } }, limit: 1, depth: 0, overrideAccess: true });
  if (unit.docs[0]) {
    const variant = await payload.findByID({ collection: 'variants', id: idOf(unit.docs[0].variant) as string, depth: 0, overrideAccess: true });
    return { variant, unit: unit.docs[0], factor: unit.docs[0].factor };
  }
  const variant = await payload.find({ collection: 'variants', where: { barcode: { equals: code } }, limit: 1, depth: 0, overrideAccess: true });
  return variant.docs[0] ? { variant: variant.docs[0], unit: undefined, factor: 1 } : null;
}

/**
 * The variants of `ids` that may be sold on `channel` (active variant of an active product, channel allowed), with
 * their product and their packaging units for that channel. Anything else is left out.
 */
export async function findSellable(payload: Payload, ids: string[], channel: Channel, locale: Locale = 'fr') {
  const [{ docs: variants }, { docs: units }] = await Promise.all([
    payload.find({
      collection: 'variants',
      where: { id: { in: [...new Set(ids)] }, active: { equals: true }, channels: { contains: channel } },
      limit: 0,
      depth: 1,
      locale,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'packagingUnits',
      where: { variant: { in: [...new Set(ids)] }, active: { equals: true }, channels: { contains: channel } },
      limit: 0,
      depth: 0,
      locale,
      overrideAccess: true,
    }),
  ]);
  return variants
    .filter((v) => typeof v.product === 'object' && v.product.status === 'active')
    .map((v) => ({ ...v, units: units.filter((u) => idOf(u.variant) === v.id) }));
}

const PAGE_SIZE = 24;

export type ProductFilters = {
  locale: Locale;
  /** `shop`: everything but the counter's dishes. `snack`: the counter. */
  kind?: 'shop' | 'snack';
  category?: string;
  q?: string;
  region?: string;
  colour?: string;
  /** Price of the cheapest size, in cents (VAT incl.). */
  minCents?: number;
  maxCents?: number;
  page?: number;
  limit?: number;
};

/** Active products for the shop and the counter: category slug, full-text search and filters, paginated (24). */
export async function listProducts(payload: Payload, f: ProductFilters) {
  const and: Where[] = [{ status: { equals: 'active' } }];
  if (f.kind) and.push({ kind: f.kind === 'snack' ? { equals: 'snack' } : { not_equals: 'snack' } });
  if (f.category) and.push({ 'category.slug': { equals: f.category } });
  if (f.region) and.push({ 'wine.region': { equals: f.region } });
  if (f.colour) and.push({ 'wine.colour': { equals: f.colour } });
  if (f.q?.trim()) {
    // Mongo's text index (custom.indexes on products): Payload has no `$text` operator, so match ids first.
    const hits = await model(payload, 'products').find({ $text: { $search: f.q.trim() } }, { _id: 1 }).limit(500).lean<{ _id: unknown }[]>();
    and.push({ id: { in: hits.map((h) => String(h._id)) } });
  }
  if (f.minCents !== undefined || f.maxCents !== undefined) {
    const { docs } = await payload.find({
      collection: 'variants',
      where: {
        active: { equals: true },
        priceCents: { ...(f.minCents !== undefined ? { greater_than_equal: f.minCents } : {}), ...(f.maxCents !== undefined ? { less_than_equal: f.maxCents } : {}) },
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      select: { product: true },
    });
    and.push({ id: { in: [...new Set(docs.map((v) => idOf(v.product)))] } });
  }
  return payload.find({
    collection: 'products',
    where: { and },
    locale: f.locale,
    page: f.page ?? 1,
    limit: f.limit ?? PAGE_SIZE,
    sort: 'name',
    depth: 1,
    overrideAccess: true,
  });
}

/** The values the shop filters offer: regions and colours of active wines, in the visitor's language. */
export async function shopFacets(payload: Payload, locale: Locale, category?: string) {
  const { docs } = await payload.find({
    collection: 'products',
    // Within a category, only the values its wines have: no Region or Colour on groceries (APPLUX report 4, §1).
    where: { status: { equals: 'active' }, kind: { equals: 'wine' }, ...(category ? { category: { equals: category } } : {}) },
    locale,
    limit: 0,
    depth: 0,
    overrideAccess: true,
    select: { wine: true },
  });
  const regions = [...new Set(docs.map((d) => d.wine?.region).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, locale));
  const colours = [...new Set(docs.map((d) => d.wine?.colour).filter((c): c is NonNullable<typeof c> => Boolean(c)))];
  return { regions, colours };
}

/** Categories of the shop or the counter that have something on sale, in their order (an imported category whose
 * products are still drafts is not offered as an empty filter). */
export async function listCategories(payload: Payload, kind: 'shop' | 'snack', locale: Locale) {
  const [{ docs }, { docs: onSale }] = await Promise.all([
    payload.find({ collection: 'categories', where: { kind: { equals: kind } }, sort: 'order', locale, limit: 50, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'products', where: { status: { equals: 'active' } }, limit: 0, depth: 0, overrideAccess: true, select: { category: true } }),
  ]);
  const used = new Set(onSale.map((p) => idOf(p.category)));
  return docs.filter((c) => used.has(c.id));
}

/** One active product by slug, with its category, producer and photos. */
export async function getProduct(payload: Payload, slug: string, locale: Locale) {
  const { docs } = await payload.find({ collection: 'products', where: { slug: { equals: slug }, status: { equals: 'active' } }, locale, limit: 1, depth: 1, overrideAccess: true });
  return docs[0] ?? null;
}

/** The sizes of products sold on the website, cheapest first, with their boxes. */
export async function sizesOf(payload: Payload, productIds: string[], locale: Locale) {
  if (productIds.length === 0) return [];
  const { docs } = await payload.find({
    collection: 'variants',
    where: { product: { in: productIds }, active: { equals: true }, channels: { contains: 'webshop' } },
    sort: 'priceCents',
    locale,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  });
  const { docs: units } = await payload.find({
    collection: 'packagingUnits',
    where: { variant: { in: docs.map((v) => v.id) }, active: { equals: true }, channels: { contains: 'webshop' } },
    sort: 'factor',
    locale,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  });
  return docs.map((v) => ({ ...v, product: idOf(v.product) as string, units: units.filter((u) => idOf(u.variant) === v.id) }));
}

/** Active product slugs with their last change, for the sitemap. */
export async function productSlugs(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'active' }, kind: { not_equals: 'snack' } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  });
  return docs;
}
