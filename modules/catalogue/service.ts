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

/** Active products for the shop and the counter, by category slug and full-text search, paginated (M2.2). */
export async function listProducts(payload: Payload, { locale, category, q, page = 1 }: { locale: Locale; category?: string; q?: string; page?: number }) {
  const where: Where = { status: { equals: 'active' } };
  if (category) where['category.slug'] = { equals: category };
  if (q?.trim()) {
    // Mongo's text index (custom.indexes on products): Payload has no `$text` operator, so match ids first.
    const hits = await model(payload, 'products').find({ $text: { $search: q.trim() } }, { _id: 1 }).limit(500).lean<{ _id: unknown }[]>();
    where.id = { in: hits.map((h) => String(h._id)) };
  }
  return payload.find({ collection: 'products', where, locale, page, limit: PAGE_SIZE, sort: 'name', depth: 1, overrideAccess: true });
}
