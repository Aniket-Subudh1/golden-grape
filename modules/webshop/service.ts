import type { Payload } from 'payload';
import type { Locale } from '@/lib/i18n';
import type { Media, Product } from '@/payload-types';
import { getProduct, listCategories, listProducts, type ProductFilters, shopFacets, sizesOf } from '@/modules/catalogue/service';
import { availability } from '@/modules/inventory/service';
import { unitPrices } from '@/modules/promotions/service';

// What the shop and counter pages show, assembled from the catalogue, stock and pricing services. Prices come from
// `quote` (via unitPrices), stock from `availability` (never the raw count).

const idOf = (value: unknown) => (typeof value === 'object' && value !== null ? (value as { id: string }).id : (value as string | undefined));

export type Photo = { src: string; alt: string; width: number; height: number };

const photoOf = (m: unknown, fallbackAlt: string): Photo | null => {
  if (!m || typeof m !== 'object') return null;
  const media = m as Media;
  return media.url ? { src: media.url, alt: media.alt || fallbackAlt, width: media.width ?? 1200, height: media.height ?? 1500 } : null;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  badge: string | null;
  photo: Photo | null;
  /** The size the card's "+" adds: the cheapest one, as one bottle. */
  variant: string | null;
  priceCents: number | null;
  /** More than one size or box: the price is shown "from". */
  from: boolean;
  inStock: boolean;
  maxQty: number | null;
  description?: unknown;
  allergens?: string[];
  ingredients?: string | null;
};

/** Card data for a page of products, in the order given. */
async function cards(payload: Payload, products: Product[], locale: Locale): Promise<ProductCardData[]> {
  const sizes = await sizesOf(payload, products.map((p) => p.id), locale);
  const first = new Map<string, (typeof sizes)[number]>();
  for (const s of sizes) if (!first.has(s.product)) first.set(s.product, s);
  const firstIds = [...first.values()].map((s) => s.id);
  const [prices, stock] = await Promise.all([unitPrices(payload, firstIds.map((variant) => ({ variant }))), availability(payload, firstIds)]);
  return products.map((p) => {
    const size = first.get(p.id);
    const options = sizes.filter((s) => s.product === p.id).reduce((n, s) => n + 1 + s.units.length, 0);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      region: p.wine?.region ?? (typeof p.brand === 'object' ? (p.brand?.origin ?? null) : null),
      badge: p.badges?.[0] ?? null,
      photo: photoOf(p.images?.[0], p.name),
      variant: size?.id ?? null,
      priceCents: size ? (prices.get(`${size.id}:`) ?? null) : null,
      from: options > 1,
      inStock: size ? (stock[size.id]?.inStock ?? false) : false,
      maxQty: size ? (stock[size.id]?.maxQty ?? null) : null,
      description: p.description,
      allergens: p.snack?.allergens ?? [],
      ingredients: p.snack?.ingredients ?? null,
    };
  });
}

/** The shop: categories, filter values, one page of cards and the paging. */
export async function shopPage(payload: Payload, filters: Omit<ProductFilters, 'kind'>) {
  const [categories, facets, result] = await Promise.all([
    listCategories(payload, 'shop', filters.locale),
    shopFacets(payload, filters.locale),
    listProducts(payload, { ...filters, kind: 'shop' }),
  ]);
  return { categories, facets, products: await cards(payload, result.docs, filters.locale), page: result.page ?? 1, totalPages: result.totalPages, total: result.totalDocs };
}

/** The counter's dishes, all on one page. */
export async function counterMenu(payload: Payload, locale: Locale) {
  const result = await listProducts(payload, { locale, kind: 'snack', limit: 60 });
  return cards(payload, result.docs, locale);
}

export type BuyOption = { key: string; variant: string; unit?: string; label: string; factor: number; priceCents: number; maxQty: number | null };

/** A product page: the product, its photos, every size and box with its price and the most that can be ordered, and related products. */
export async function productPage(payload: Payload, slug: string, locale: Locale) {
  const product = await getProduct(payload, slug, locale);
  if (!product) return null;
  const sizes = await sizesOf(payload, [product.id], locale);
  const choices = sizes.flatMap((s) => [{ variant: s.id, label: s.label ?? product.name, factor: 1 }, ...s.units.map((u) => ({ variant: s.id, unit: u.id, label: u.label, factor: u.factor }))]);
  const [prices, stock] = await Promise.all([unitPrices(payload, choices), availability(payload, sizes.map((s) => s.id))]);
  const options: BuyOption[] = choices.flatMap((c) => {
    const priceCents = prices.get(`${c.variant}:${'unit' in c ? (c.unit ?? '') : ''}`);
    if (priceCents === undefined) return [];
    const max = stock[c.variant]?.maxQty ?? null;
    return [{ key: `${c.variant}:${'unit' in c ? (c.unit ?? '') : ''}`, ...c, priceCents, maxQty: max === null ? null : Math.floor(max / c.factor) }];
  });
  const category = typeof product.category === 'object' ? product.category : null;
  const related = category
    ? (await listProducts(payload, { locale, kind: 'shop', category: category.slug, limit: 5 })).docs.filter((p) => p.id !== product.id).slice(0, 4)
    : [];
  return {
    product,
    category,
    brand: typeof product.brand === 'object' ? product.brand : null,
    photos: (product.images ?? []).map((m) => photoOf(m, product.name)).filter((p): p is Photo => p !== null),
    options,
    inStock: options.some((o) => o.maxQty === null || o.maxQty > 0),
    related: await cards(payload, related, locale),
    categoryId: idOf(product.category),
  };
}
