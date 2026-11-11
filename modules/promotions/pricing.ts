import { add, divRound, mulQty, pct, vatFromGross } from '@/lib/money';

// The one pricing engine (02 §5.2, 04 §6). Pure: no Payload import. Every price shown or charged comes from `quote`.
// Implemented: step 1 with the public price (M2.2), step 4 delivery (M2.3) and step 5 (VAT per rate). Steps 2, 3, 6
// and 7 are no-ops that M3.2 (price lists, promotions, codes, loyalty, gift cards) fills in; the input and output
// types are already final, so callers do not change.

export type Channel = 'webshop' | 'mobile' | 'pos';
export type VatClass = 'standard' | 'intermediate' | 'reduced' | 'superReduced';

export type QuoteLineInput = { variant: string; unit?: string; qty: number };

/** What `quote` needs to know about each variant and packaging unit of the lines. */
export type QuoteCatalogue = {
  variants: Record<string, { priceCents: number; vatClass: VatClass; product: string; category?: string; brand?: string }>;
  units: Record<string, { variant: string; factor: number; priceCents?: number | null }>;
};

/** Business rules; v1 reads only `vatRates`. */
export type QuoteRules = {
  vatRates: Record<VatClass, number>;
  priceLists?: unknown[];
  promotions?: unknown[];
  codes?: unknown[];
  delivery?: { feeCents: number; freeFromCents?: number | null } | null;
  loyalty?: { pointValueCents: number } | null;
};

export type QuoteInput = {
  lines: QuoteLineInput[];
  customer?: { id: string; group?: string | null; priceList?: string | null } | null;
  channel: Channel;
  code?: string | null;
  loyaltyPoints?: number;
  giftCards?: { code: string; balanceCents: number }[];
  now: Date;
  catalogue: QuoteCatalogue;
  rules: QuoteRules;
};

export type QuoteLine = {
  variant: string;
  unit?: string;
  /** Number of units (bottles, or boxes when `unit` is set). */
  qty: number;
  /** Base units moved: qty × factor. */
  baseQty: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  vatBp: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  vatCents: number;
  totalCents: number;
  vatBreakdown: { rateBp: number; baseCents: number; vatCents: number }[];
  promotions: string[];
  code: string | null;
  loyaltyPointsUsed: number;
  loyaltyCents: number;
  giftCards: { code: string; amountCents: number }[];
  amountDueCents: number;
};

/** VAT-inclusive amounts per rate → the breakdown printed on documents (highest rate first), VAT taken per rate. */
function vatByRate(grossByRate: Map<number, number>) {
  return [...grossByRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rateBp, grossCents]) => {
      const vatCents = vatFromGross(grossCents, rateBp);
      return { rateBp, baseCents: grossCents - vatCents, vatCents };
    });
}

/** Prices the lines. Throws when a line points at a variant or unit missing from `catalogue` (the caller filters). */
export function quote(input: QuoteInput): Quote {
  const { catalogue, rules } = input;

  // Step 1: base unit price. v1: the packaging unit's own price, else factor × the variant's public price.
  const lines: QuoteLine[] = input.lines.map((line) => {
    if (!Number.isInteger(line.qty) || line.qty < 1) throw new Error(`quote: quantity ${line.qty} is not a whole number ≥ 1`);
    const variant = catalogue.variants[line.variant];
    if (!variant) throw new Error(`quote: unknown variant ${line.variant}`);
    const unit = line.unit ? catalogue.units[line.unit] : undefined;
    if (line.unit && (!unit || unit.variant !== line.variant)) throw new Error(`quote: unit ${line.unit} is not a unit of ${line.variant}`);
    const factor = unit?.factor ?? 1;
    const unitPriceCents = unit?.priceCents ?? mulQty(variant.priceCents, factor);
    const totalCents = mulQty(unitPriceCents, line.qty);
    return {
      variant: line.variant,
      ...(line.unit ? { unit: line.unit } : {}),
      qty: line.qty,
      baseQty: line.qty * factor,
      unitPriceCents,
      discountCents: 0,
      totalCents,
      vatBp: rules.vatRates[variant.vatClass],
    };
  });

  // Steps 2–3 (promotion, code): M3.2.
  const subtotalCents = add(...lines.map((l) => l.totalCents));
  const discountCents = 0;

  // Step 4: delivery, free from the zone's threshold (on the discounted goods total). The fee carries standard VAT.
  const goodsCents = subtotalCents - discountCents;
  const delivery = rules.delivery;
  const deliveryCents = delivery && lines.length > 0 && !(delivery.freeFromCents != null && goodsCents >= delivery.freeFromCents) ? delivery.feeCents : 0;

  // Step 5: VAT per rate group, so the breakdown matches the invoice.
  const byRate = new Map<number, number>();
  for (const line of lines) byRate.set(line.vatBp, (byRate.get(line.vatBp) ?? 0) + line.totalCents - line.discountCents);
  if (deliveryCents > 0) byRate.set(rules.vatRates.standard, (byRate.get(rules.vatRates.standard) ?? 0) + deliveryCents);
  const vatBreakdown = vatByRate(byRate);
  const totalCents = subtotalCents - discountCents + deliveryCents;

  // Steps 6–7 (loyalty points, gift cards as means of payment): M3.2.
  return {
    lines,
    subtotalCents,
    discountCents,
    deliveryCents,
    vatCents: add(...vatBreakdown.map((v) => v.vatCents)),
    totalCents,
    vatBreakdown,
    promotions: [],
    code: null,
    loyaltyPointsUsed: 0,
    loyaltyCents: 0,
    giftCards: [],
    amountDueCents: totalCents,
  };
}

// ---- Documents with free lines (catering quotations) -------------------------------------------------------------
// A catering quotation is priced line by line by staff (a menu per guest, service, rentals…), not from the catalogue:
// its prices are typed, VAT-inclusive like every B2C price (D-04). This is the one place that turns them into totals.

export type DocumentLineInput = { qty: number; unitPriceCents: number; vatBp: number };
/** `percent`: `value` in basis points (1000 = 10 %); `amount`: `value` in cents, VAT included. */
export type DocumentDiscount = { kind: 'none' | 'percent' | 'amount'; value?: number | null };
export type PricedDocument = {
  /** Each line's total and its share of the discount, in the order given. */
  lines: { totalCents: number; discountCents: number }[];
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
  vatBreakdown: { rateBp: number; baseCents: number; vatCents: number }[];
};

/**
 * Totals of a document with free lines. Quantities may have two decimals (2,5 hours); a line is qty × unit price,
 * rounded half away from zero. The discount (a percentage of the subtotal, or an amount) is shared between the lines in
 * proportion to their totals, the cents left over going to the largest remainders, so the VAT of each rate is taken on
 * what is really charged. A discount above the subtotal is refused.
 */
export function priceDocument(lines: DocumentLineInput[], discount: DocumentDiscount = { kind: 'none' }): PricedDocument {
  const totals = lines.map((line) => {
    if (!(line.qty > 0)) throw new Error(`priceDocument: quantity ${line.qty} is not positive`);
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) throw new Error(`priceDocument: price ${line.unitPriceCents} is not whole cents ≥ 0`);
    return divRound(line.unitPriceCents * Math.round(line.qty * 100), 100);
  });
  const subtotalCents = add(...totals);
  const value = discount.value ?? 0;
  const discountCents = discount.kind === 'percent' ? pct(subtotalCents, value) : discount.kind === 'amount' ? value : 0;
  if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents) throw new Error('discount');

  // Largest-remainder split of the discount over the lines.
  const shares = totals.map((t, i) => {
    const exact = subtotalCents === 0 ? 0 : (discountCents * t) / subtotalCents;
    return { i, cents: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = discountCents - add(...shares.map((s) => s.cents));
  for (const s of [...shares].sort((a, b) => b.rest - a.rest || a.i - b.i)) {
    if (left <= 0) break;
    s.cents += 1;
    left -= 1;
  }

  const byRate = new Map<number, number>();
  lines.forEach((line, i) => byRate.set(line.vatBp, (byRate.get(line.vatBp) ?? 0) + totals[i] - shares[i].cents));
  const vatBreakdown = vatByRate(byRate);
  return {
    lines: totals.map((totalCents, i) => ({ totalCents, discountCents: shares[i].cents })),
    subtotalCents,
    discountCents,
    vatCents: add(...vatBreakdown.map((v) => v.vatCents)),
    totalCents: subtotalCents - discountCents,
    vatBreakdown,
  };
}
