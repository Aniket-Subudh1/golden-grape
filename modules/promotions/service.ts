import type { Payload } from 'payload';
import type { Locale } from '@/lib/i18n';
import type { Media } from '@/payload-types';
import { findSellable } from '@/modules/catalogue/service';
import { availability } from '@/modules/inventory/service';
import { getSettingsPrivate } from '@/modules/settings/service';
import { type Channel, quote, type QuoteCatalogue, type QuoteLineInput, type QuoteRules, type VatClass } from './pricing';

// I/O around the pricing engine: loads what `quote` needs (02 §5.2). The shop, the cart, checkout (M2.3), mobile
// sales and documents (M3.x) all price through here; nothing else computes a price.

/** Statutory Luxembourg rates, used for any class not configured in BusinessSettings (assumption A-07, DEP-07). */
const LU_VAT: Record<VatClass, number> = { standard: 1700, intermediate: 1400, reduced: 800, superReduced: 300 };

export async function vatRates(): Promise<Record<VatClass, number>> {
  const { vat } = await getSettingsPrivate();
  return { ...LU_VAT, ...Object.fromEntries((vat ?? []).map((v) => [v.key, v.rateBp])) };
}

const idOf = (value: unknown) => (typeof value === 'object' && value !== null ? (value as { id: string }).id : (value as string | undefined));

type Sellable = Awaited<ReturnType<typeof findSellable>>[number];

function catalogueOf(sellable: Sellable[]): QuoteCatalogue {
  const catalogue: QuoteCatalogue = { variants: {}, units: {} };
  for (const v of sellable) {
    const product = v.product as { id: string; vatClass: VatClass; category?: unknown; brand?: unknown };
    catalogue.variants[v.id] = { priceCents: v.priceCents, vatClass: product.vatClass, product: product.id, category: idOf(product.category), brand: idOf(product.brand) };
    for (const u of v.units) catalogue.units[u.id] = { variant: v.id, factor: u.factor, priceCents: u.priceCents };
  }
  return catalogue;
}

/** The price of one of each option (a bottle, a box of 6…), for cards and product pages. Key: `variant:unit`. */
export async function unitPrices(payload: Payload, options: { variant: string; unit?: string }[], channel: Channel = 'webshop') {
  const sellable = await findSellable(payload, options.map((o) => o.variant), channel);
  const catalogue = catalogueOf(sellable);
  const lines = options.filter((o) => catalogue.variants[o.variant] && (!o.unit || catalogue.units[o.unit])).map((o) => ({ ...o, qty: 1 }));
  const q = quote({ lines, channel, now: new Date(), catalogue, rules: { vatRates: await vatRates() } });
  return new Map(q.lines.map((l) => [`${l.variant}:${l.unit ?? ''}`, l.unitPriceCents]));
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
  { customer, channel, locale, delivery }: { customer?: { id: string } | null; channel: Channel; locale: Locale; delivery?: QuoteRules['delivery'] },
) {
  const ids = [...new Set(input.map((l) => l.variant))];
  const [sellable, stock, rates] = await Promise.all([findSellable(payload, ids, channel, locale), availability(payload, ids), vatRates()]);
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
    if (qty < line.qty) notices.push({ variant: line.variant, unit: line.unit, kind: qty === 0 ? 'removed' : 'clamped', qty });
    if (qty === 0) continue;
    if (remaining !== null) left.set(line.variant, remaining - qty * factor);
    lines.push({ ...line, qty, maxQty: maxQty === null ? null : qty + Math.floor((left.get(line.variant) ?? 0) / factor) });
  }

  const q = quote({ lines, customer, channel, now: new Date(), catalogue, rules: { vatRates: rates, delivery } });

  const productImages = sellable.map((v) => (v.product as { images?: unknown[] }).images?.[0]).map(idOf).filter(Boolean) as string[];
  const { docs: media } = productImages.length
    ? await payload.find({ collection: 'media', where: { id: { in: productImages } }, limit: 0, depth: 0, overrideAccess: true })
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
