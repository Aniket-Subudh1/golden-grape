import { add, mulQty, vatFromGross } from '@/lib/money';

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
  const vatBreakdown = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rateBp, grossCents]) => {
      const vatCents = vatFromGross(grossCents, rateBp);
      return { rateBp, baseCents: grossCents - vatCents, vatCents };
    });
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
