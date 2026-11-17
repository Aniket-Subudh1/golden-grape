import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import type { Tx } from '@/lib/tx';
import type { Media } from '@/payload-types';
import { findSellable } from '@/modules/catalogue/service';
import { availability } from '@/modules/inventory/service';
import type { ModuleName } from '@/modules/settings/globals';
import { getSettingsPrivate } from '@/modules/settings/service';
import {
  type Channel,
  type DiscountCode,
  type PriceList,
  type Promotion,
  quote,
  type QuoteCatalogue,
  type QuoteLineInput,
  type QuoteRules,
  type VatClass,
} from './pricing';

// I/O around the pricing engine: loads what `quote` needs (02 §5.2). The shop, the cart, checkout (M2.3), mobile
// sales and documents (M3.x) all price through here; nothing else computes a price.

/** Statutory Luxembourg rates, used for any class not configured in BusinessSettings (assumption A-07, DEP-07). */
const LU_VAT: Record<VatClass, number> = { standard: 1700, intermediate: 1400, reduced: 800, superReduced: 300 };

export async function vatRates(): Promise<Record<VatClass, number>> {
  const { vat } = await getSettingsPrivate();
  return { ...LU_VAT, ...Object.fromEntries((vat ?? []).map((v) => [v.key, v.rateBp])) };
}

/** VAT rates and the module switches in one read (pricing runs outside a page request too: actions, tests). */
async function settingsForPricing() {
  const { vat, modules } = await getSettingsPrivate();
  return {
    vatRates: { ...LU_VAT, ...Object.fromEntries((vat ?? []).map((v) => [v.key, v.rateBp])) } as Record<
      VatClass,
      number
    >,
    on: (name: ModuleName) => modules?.[name] === true,
  };
}

const idOf = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as { id: string }).id : (value as string | undefined);

type Sellable = Awaited<ReturnType<typeof findSellable>>[number];

function catalogueOf(sellable: Sellable[]): QuoteCatalogue {
  const catalogue: QuoteCatalogue = { variants: {}, units: {} };
  for (const v of sellable) {
    const product = v.product as { id: string; vatClass: VatClass; category?: unknown; brand?: unknown };
    catalogue.variants[v.id] = {
      priceCents: v.priceCents,
      vatClass: product.vatClass,
      product: product.id,
      category: idOf(product.category),
      brand: idOf(product.brand),
    };
    for (const u of v.units) catalogue.units[u.id] = { variant: v.id, factor: u.factor, priceCents: u.priceCents };
  }
  return catalogue;
}

type Who = { id: string } | null | undefined;

const asList = (
  doc:
    | {
        id: string;
        pricesInclVat?: boolean | null;
        validFrom?: string | null;
        validTo?: string | null;
        lines?: { variant: unknown; unit?: unknown; priceCents: number }[] | null;
      }
    | null
    | undefined,
): PriceList | null =>
  doc
    ? {
        id: doc.id,
        inclVat: doc.pricesInclVat === true,
        validFrom: doc.validFrom,
        validTo: doc.validTo,
        lines: (doc.lines ?? []).map((l) => ({
          variant: idOf(l.variant) as string,
          unit: idOf(l.unit) ?? null,
          priceCents: l.priceCents,
        })),
      }
    : null;

/** The customer's own price list and their group's (B2B module on): step 1 of `quote`. */
async function priceListsOf(payload: Payload, customer: Who, on: boolean): Promise<QuoteRules['priceLists']> {
  if (!customer || !on) return undefined;
  const doc = await payload.findByID({
    collection: 'customers',
    id: customer.id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    select: { priceList: true, group: true },
  });
  if (!doc) return undefined;
  const group = doc.group
    ? await payload.findByID({
        collection: 'customerGroups',
        id: idOf(doc.group) as string,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      })
    : null;
  const ids = [idOf(doc.priceList), idOf(group?.priceList)].filter(Boolean) as string[];
  if (ids.length === 0) return undefined;
  const { docs } = await payload.find({
    collection: 'priceLists',
    where: { id: { in: ids } },
    depth: 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
  });
  const byId = (id: unknown) => asList(docs.find((d) => d.id === idOf(id)));
  return { customer: byId(doc.priceList), group: byId(group?.priceList) };
}

/** The switched-on promotions (Promotions module on); dates and channels are checked by `quote`. */
async function activePromotions(payload: Payload, on: boolean): Promise<Promotion[]> {
  if (!on) return [];
  const { docs } = await payload.find({
    collection: 'promotions',
    where: { active: { equals: true } },
    depth: 0,
    limit: 200,
    overrideAccess: true,
    pagination: false,
  });
  return docs.map((p) => ({
    id: p.id,
    type: p.type,
    value: (p.type === 'fixed' ? p.amountCents : p.percentBp) ?? 0,
    target: p.target,
    targets: (p.targets ?? []).map((t) => idOf(t.value) as string),
    channels: (p.channels ?? []) as Channel[],
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    active: p.active !== false,
    priority: p.priority,
  }));
}

/** The order statuses that count as a use of a code (a cancelled order gives its use back). */
const COUNTED = ['pending', 'awaiting_payment', 'confirmed', 'ready', 'out_for_delivery', 'completed', 'refunded'];

/** A typed code as stored (upper-cased), with how often this customer used it; null if there is no such code. */
export async function findCode(
  payload: Payload,
  typed: string | null | undefined,
  customer: Who,
  on = true,
): Promise<DiscountCode | null> {
  const text = typed?.trim().toUpperCase().replace(/\s+/g, '');
  if (!text || !on) return null;
  const { docs } = await payload.find({
    collection: 'discountCodes',
    where: { code: { equals: text } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
  });
  const c = docs[0];
  if (!c) return null;
  const usesByCustomer = customer
    ? (
        await payload.count({
          collection: 'orders',
          where: { 'pricing.code': { equals: c.code }, customer: { equals: customer.id }, status: { in: COUNTED } },
          overrideAccess: true,
        })
      ).totalDocs
    : 0;
  return {
    code: c.code,
    type: c.type,
    value: (c.type === 'fixed' ? c.amountCents : c.percentBp) ?? 0,
    minOrderCents: c.minOrderCents,
    maxUses: c.maxUses,
    uses: c.uses ?? 0,
    maxUsesPerCustomer: c.maxUsesPerCustomer,
    usesByCustomer,
    customers: (c.customers ?? []).map((x) => idOf(x) as string),
    channels: (c.channels ?? []) as Channel[],
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    active: c.active !== false,
  };
}

/** Everything `quote` needs beyond the catalogue, for one customer on one channel (04 §6). */
export async function pricingRules(
  payload: Payload,
  { customer, code }: { customer?: Who; code?: string | null } = {},
): Promise<QuoteRules> {
  const settings = await settingsForPricing();
  const [priceLists, promotions, found] = await Promise.all([
    priceListsOf(payload, customer, settings.on('b2b')),
    activePromotions(payload, settings.on('promotions')),
    code ? findCode(payload, code, customer, settings.on('promotions')) : null,
  ]);
  return { vatRates: settings.vatRates, priceLists, promotions, code: found };
}

/**
 * The price of one of each option (a bottle, a box of 6…) for cards and product pages, for this customer (their list
 * prices) and with the best promotion: `priceCents` to pay, `wasCents` before a promotion. Key: `variant:unit`.
 */
export async function unitPrices(
  payload: Payload,
  options: { variant: string; unit?: string }[],
  { channel = 'webshop', customer }: { channel?: Channel; customer?: Who } = {},
) {
  const [sellable, rules] = await Promise.all([
    findSellable(
      payload,
      options.map((o) => o.variant),
      channel,
    ),
    pricingRules(payload, { customer }),
  ]);
  const catalogue = catalogueOf(sellable);
  const lines = options
    .filter((o) => catalogue.variants[o.variant] && (!o.unit || catalogue.units[o.unit]))
    .map((o) => ({ ...o, qty: 1 }));
  const q = quote({ lines, channel, customer, now: new Date(), catalogue, rules });
  return new Map(
    q.lines.map((l) => [
      `${l.variant}:${l.unit ?? ''}`,
      { priceCents: l.totalCents, wasCents: l.promoCents > 0 ? l.unitPriceCents : null },
    ]),
  );
}

export type CartNotice = { variant: string; unit?: string; kind: 'clamped' | 'removed'; qty: number };

/**
 * Prices a cart for display: server prices only (any client price is ignored), with the localized name, photo and
 * the most that can be added. Lines no longer for sale are dropped; lines above the stock are clamped. Both are
 * reported in `notices` so the cart can tell the visitor and correct itself.
 */
export async function quoteCart(
  payload: Payload,
  input: QuoteLineInput[],
  {
    customer,
    channel,
    locale,
    delivery,
    code,
  }: {
    customer?: { id: string } | null;
    channel: Channel;
    locale: Locale;
    delivery?: QuoteRules['delivery'];
    code?: string | null;
  },
) {
  const ids = [...new Set(input.map((l) => l.variant))];
  const [sellable, stock, rules] = await Promise.all([
    findSellable(payload, ids, channel, locale),
    availability(payload, ids),
    pricingRules(payload, { customer, code }),
  ]);
  const catalogue = catalogueOf(sellable);
  const notices: CartNotice[] = [];
  const left = new Map(ids.map((id) => [id, stock[id]?.maxQty ?? null]));

  const lines: (QuoteLineInput & { maxQty: number | null })[] = [];
  for (const line of input) {
    if (!catalogue.variants[line.variant] || (line.unit && catalogue.units[line.unit]?.variant !== line.variant)) {
      notices.push({ variant: line.variant, unit: line.unit, kind: 'removed', qty: 0 });
      continue;
    }
    const factor = line.unit ? catalogue.units[line.unit].factor : 1;
    const remaining = left.get(line.variant) ?? null;
    const maxQty = remaining === null ? null : Math.floor(remaining / factor);
    const qty = maxQty === null ? line.qty : Math.min(line.qty, maxQty);
    if (qty < line.qty)
      notices.push({ variant: line.variant, unit: line.unit, kind: qty === 0 ? 'removed' : 'clamped', qty });
    if (qty === 0) continue;
    if (remaining !== null) left.set(line.variant, remaining - qty * factor);
    lines.push({
      ...line,
      qty,
      maxQty: maxQty === null ? null : qty + Math.floor((left.get(line.variant) ?? 0) / factor),
    });
  }

  const q = quote({ lines, customer, channel, code, now: new Date(), catalogue, rules: { ...rules, delivery } });

  const productImages = sellable
    .map((v) => (v.product as { images?: unknown[] }).images?.[0])
    .map(idOf)
    .filter(Boolean) as string[];
  const { docs: media } = productImages.length
    ? await payload.find({
        collection: 'media',
        where: { id: { in: productImages } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] as Media[] };
  const imageOf = new Map(media.map((m) => [m.id, m.sizes?.thumb?.url ?? m.url ?? null]));

  return {
    ...q,
    lines: q.lines.map((l, i) => {
      const v = sellable.find((s) => s.id === l.variant) as Sellable;
      const product = v.product as { name: string; slug: string; kind: string; images?: unknown[] };
      const unit = l.unit ? v.units.find((u) => u.id === l.unit) : undefined;
      const sizeLabel = unit?.label ?? (v.label && v.label !== product.name ? v.label : null);
      return {
        ...l,
        name: product.name,
        detail: sizeLabel,
        slug: product.slug,
        kind: product.kind,
        image: imageOf.get(idOf(product.images?.[0]) ?? '') ?? null,
        maxQty: lines[i].maxQty,
      };
    }),
    notices,
  };
}

export type CartQuote = Awaited<ReturnType<typeof quoteCart>>;

/** The order's quote, as far as `redeem` needs it. */
type Redeemable = Pick<CartQuote, 'code' | 'loyaltyPointsUsed' | 'giftCards'>;

/**
 * What the order spends beyond money, inside the order's transaction (02 §5.2, M3.2 T4): the code's use, counted only
 * while uses < maxUses, and the customer's own limit checked again in the same transaction. A conditional update that
 * matches nothing (the last use taken by a parallel order) throws CONFLICT, which rolls the whole order back. Loyalty
 * points and gift cards join here with T3. `placeOrder` and `placeStaffOrder` call it; nothing else spends them.
 */
export async function redeem(tx: Tx, q: Redeemable, { order, customer }: { order: string; customer?: string | null }) {
  if (q.code) {
    const codes = tx.model('discountCodes');
    const claim = await codes.updateOne(
      { code: q.code, $or: [{ maxUses: null }, { $expr: { $lt: ['$uses', '$maxUses'] } }] },
      { $inc: { uses: 1 } },
      { session: tx.session },
    );
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'CODE_USED_UP', 'code');
    const doc = await codes
      .findOne({ code: q.code }, { maxUsesPerCustomer: 1 }, { session: tx.session })
      .lean<{ maxUsesPerCustomer?: number | null }>();
    if (customer && doc?.maxUsesPerCustomer != null) {
      const used = await tx
        .model('orders')
        .countDocuments(
          { 'pricing.code': q.code, customer, status: { $in: COUNTED }, _id: { $ne: order } },
          { session: tx.session },
        );
      if (used >= doc.maxUsesPerCustomer) throw new AppError('CONFLICT', 'CODE_ALREADY_USED', 'code');
    }
  }
}
