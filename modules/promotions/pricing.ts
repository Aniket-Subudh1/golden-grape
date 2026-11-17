import { add, divRound, mulQty, netToGross, pct, vatFromGross } from '@/lib/money';

// The one pricing engine (02 §5.2, 04 §6). Pure: no Payload import. Every price shown or charged comes from `quote`,
// and every step of 04 §6 is here (M3.2 T4): price lists, the best promotion, the discount code, delivery, VAT per
// rate, then loyalty points and gift cards as means of payment. service.ts loads what it needs; the vectors in
// pricing.test.ts pin each step.

export type Channel = 'webshop' | 'mobile' | 'pos';
export type VatClass = 'standard' | 'intermediate' | 'reduced' | 'superReduced';

export type QuoteLineInput = { variant: string; unit?: string; qty: number };

/** What `quote` needs to know about each variant and packaging unit of the lines. */
export type QuoteCatalogue = {
  variants: Record<
    string,
    { priceCents: number; vatClass: VatClass; product: string; category?: string; brand?: string }
  >;
  units: Record<string, { variant: string; factor: number; priceCents?: number | null }>;
};

/** A price list as `quote` reads it: prices per size (`unit` empty = the bottle) or per box, net unless `inclVat`. */
export type PriceList = {
  id: string;
  inclVat: boolean;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  lines: { variant: string; unit?: string | null; priceCents: number }[];
};

export type Promotion = {
  id: string;
  type: 'percent' | 'fixed';
  /** Basis points for `percent`; cents (VAT included) off each unit for `fixed`. */
  value: number;
  target: 'all' | 'products' | 'categories' | 'brands';
  targets: string[];
  channels: Channel[];
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  active: boolean;
  priority?: number | null;
};

export type DiscountCode = {
  code: string;
  type: 'percent' | 'fixed';
  /** Basis points for `percent`; cents (VAT included) off the order for `fixed`. */
  value: number;
  minOrderCents?: number | null;
  maxUses?: number | null;
  uses: number;
  maxUsesPerCustomer?: number | null;
  /** How many times this customer already used it (counted by the service). */
  usesByCustomer?: number;
  customers?: string[];
  channels: Channel[];
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  active: boolean;
};

export type GiftCardInput = { code: string; balanceCents: number; expiresAt?: Date | string | null; active?: boolean };

export type CodeRejection =
  | 'CODE_UNKNOWN'
  | 'CODE_INACTIVE'
  | 'CODE_NOT_STARTED'
  | 'CODE_EXPIRED'
  | 'CODE_CHANNEL'
  | 'CODE_MIN_NOT_MET'
  | 'CODE_USED_UP'
  | 'CODE_NOT_FOR_YOU'
  | 'CODE_ALREADY_USED';
export type GiftCardRejection = 'GIFT_CARD_UNKNOWN' | 'GIFT_CARD_EXPIRED' | 'GIFT_CARD_EMPTY' | 'GIFT_CARD_VOID';

export type QuoteRules = {
  vatRates: Record<VatClass, number>;
  /** The customer's own list first, then their group's (step 1). */
  priceLists?: { customer?: PriceList | null; group?: PriceList | null };
  promotions?: Promotion[];
  /** The code typed, as found (null when no such code exists: `CODE_UNKNOWN`). */
  code?: DiscountCode | null;
  delivery?: { feeCents: number; freeFromCents?: number | null } | null;
  loyalty?: { pointValueCents: number } | null;
};

export type QuoteInput = {
  lines: QuoteLineInput[];
  customer?: { id: string } | null;
  channel: Channel;
  /** The code the customer typed (looked up by the service into `rules.code`). */
  code?: string | null;
  /** Points the customer wants to use, already capped at their balance by the service. */
  loyaltyPoints?: number;
  giftCards?: GiftCardInput[];
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
  /** Step 1: the list price (gross) or the public price of one unit. */
  unitPriceCents: number;
  /** Step 1 came from a price list (B2B): no promotion applies (A-03). */
  fromList: boolean;
  /** Step 2: the best promotion's discount on the line, and which one. */
  promoCents: number;
  promotion: string | null;
  /** qty × unit price − promotion. */
  totalCents: number;
  /** Step 3: this line's share of the discount code. Charged = totalCents − discountCents. */
  discountCents: number;
  vatBp: number;
};

export type Quote = {
  lines: QuoteLine[];
  /** Σ line totals after promotions (the base of the code's minimum and percentage). */
  subtotalCents: number;
  promotionCents: number;
  /** The discount code's amount. */
  discountCents: number;
  deliveryCents: number;
  vatCents: number;
  totalCents: number;
  vatBreakdown: { rateBp: number; baseCents: number; vatCents: number }[];
  promotions: string[];
  code: string | null;
  codeRejected: CodeRejection | null;
  loyaltyPointsUsed: number;
  loyaltyCents: number;
  giftCards: { code: string; amountCents: number }[];
  giftCardsRejected: { code: string; reason: GiftCardRejection }[];
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

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);
/** `now` within [from, to]; a missing bound is open. */
const within = (now: Date, from?: Date | string | null, to?: Date | string | null) =>
  (time(from) ?? -Infinity) <= now.getTime() && now.getTime() <= (time(to) ?? Infinity);

/** Step 1 for one line: the customer's list, then the group's (each valid at `now`), as gross cents; else null. */
function listPrice(
  lists: QuoteRules['priceLists'],
  variant: string,
  unit: string | undefined,
  vatBp: number,
  now: Date,
) {
  for (const list of [lists?.customer, lists?.group]) {
    if (!list || !within(now, list.validFrom, list.validTo)) continue;
    const line = list.lines.find((l) => l.variant === variant && (l.unit ?? undefined) === unit);
    if (line) return list.inclVat ? line.priceCents : netToGross(line.priceCents, vatBp);
  }
  return null;
}

/** Step 2: the promotions that apply to a line, by product, category or brand, channel, date and switch. */
function matches(p: Promotion, v: QuoteCatalogue['variants'][string], channel: Channel, now: Date) {
  if (!p.active || !p.channels.includes(channel) || !within(now, p.startsAt, p.endsAt)) return false;
  if (p.target === 'all') return true;
  const id = p.target === 'products' ? v.product : p.target === 'categories' ? v.category : v.brand;
  return Boolean(id) && p.targets.includes(id as string);
}

/** Step 3: why a code cannot be used on this cart, or null when it can. */
function codeProblem(
  c: DiscountCode | null | undefined,
  input: QuoteInput,
  subtotalCents: number,
): CodeRejection | null {
  if (!c) return 'CODE_UNKNOWN';
  if (!c.active) return 'CODE_INACTIVE';
  if (time(c.startsAt) !== null && input.now.getTime() < (time(c.startsAt) as number)) return 'CODE_NOT_STARTED';
  if (time(c.endsAt) !== null && input.now.getTime() > (time(c.endsAt) as number)) return 'CODE_EXPIRED';
  if (!c.channels.includes(input.channel)) return 'CODE_CHANNEL';
  if (c.customers?.length && !c.customers.includes(input.customer?.id ?? '')) return 'CODE_NOT_FOR_YOU';
  if (c.maxUses != null && c.uses >= c.maxUses) return 'CODE_USED_UP';
  if (c.maxUsesPerCustomer != null && (c.usesByCustomer ?? 0) >= c.maxUsesPerCustomer) return 'CODE_ALREADY_USED';
  if (c.minOrderCents != null && subtotalCents < c.minOrderCents) return 'CODE_MIN_NOT_MET';
  return null;
}

/** Shares `amount` over the lines in proportion to their totals; the cents left over go to the largest line (first on a tie). */
function spread(amount: number, totals: number[]) {
  const sum = add(...totals);
  if (amount === 0 || sum === 0) return totals.map(() => 0);
  const shares = totals.map((t) => Math.floor((amount * t) / sum));
  const largest = totals.indexOf(Math.max(...totals));
  shares[largest] += amount - add(...shares);
  return shares;
}

/** Prices the lines. Throws when a line points at a variant or unit missing from `catalogue` (the caller filters). */
export function quote(input: QuoteInput): Quote {
  const { catalogue, rules, now } = input;

  const lines: QuoteLine[] = input.lines.map((line) => {
    if (!Number.isInteger(line.qty) || line.qty < 1)
      throw new Error(`quote: quantity ${line.qty} is not a whole number ≥ 1`);
    const variant = catalogue.variants[line.variant];
    if (!variant) throw new Error(`quote: unknown variant ${line.variant}`);
    const unit = line.unit ? catalogue.units[line.unit] : undefined;
    if (line.unit && (!unit || unit.variant !== line.variant))
      throw new Error(`quote: unit ${line.unit} is not a unit of ${line.variant}`);
    const factor = unit?.factor ?? 1;
    const vatBp = rules.vatRates[variant.vatClass];

    // Step 1: the customer's list, the group's, the box's own price, else factor × the bottle's public price.
    const fromList = listPrice(rules.priceLists, line.variant, line.unit, vatBp, now);
    const unitPriceCents = fromList ?? unit?.priceCents ?? mulQty(variant.priceCents, factor);
    const gross = mulQty(unitPriceCents, line.qty);

    // Step 2: the single best promotion (lowest line total; then priority, then the first listed). None on list prices.
    let promoCents = 0;
    let promotion: string | null = null;
    let priority = -Infinity;
    if (fromList === null) {
      for (const p of rules.promotions ?? []) {
        if (!matches(p, variant, input.channel, now)) continue;
        const off = Math.min(gross, p.type === 'percent' ? pct(gross, p.value) : mulQty(p.value, line.qty));
        if (off > promoCents || (off === promoCents && promotion !== null && (p.priority ?? 0) > priority)) {
          promoCents = off;
          promotion = off > 0 ? p.id : null;
          priority = p.priority ?? 0;
        }
      }
    }
    return {
      variant: line.variant,
      ...(line.unit ? { unit: line.unit } : {}),
      qty: line.qty,
      baseQty: line.qty * factor,
      unitPriceCents,
      fromList: fromList !== null,
      promoCents,
      promotion,
      totalCents: gross - promoCents,
      discountCents: 0,
      vatBp,
    };
  });
  const subtotalCents = add(...lines.map((l) => l.totalCents));

  // Step 3: the discount code, validated on the subtotal after promotions, spread over the lines for VAT.
  let discountCents = 0;
  let code: string | null = null;
  let codeRejected: CodeRejection | null = null;
  if (input.code?.trim()) {
    codeRejected = codeProblem(rules.code, input, subtotalCents);
    if (!codeRejected && rules.code) {
      discountCents = Math.min(
        subtotalCents,
        rules.code.type === 'percent' ? pct(subtotalCents, rules.code.value) : rules.code.value,
      );
      code = rules.code.code;
      spread(
        discountCents,
        lines.map((l) => l.totalCents),
      ).forEach((share, i) => (lines[i].discountCents = share));
    }
  }

  // Step 4: delivery, free from the zone's threshold on the goods after the code. The fee carries standard VAT.
  const goodsCents = subtotalCents - discountCents;
  const delivery = rules.delivery;
  const deliveryCents =
    delivery && lines.length > 0 && !(delivery.freeFromCents != null && goodsCents >= delivery.freeFromCents)
      ? delivery.feeCents
      : 0;

  // Step 5: VAT per rate group, so the breakdown matches the invoice.
  const byRate = new Map<number, number>();
  for (const line of lines)
    byRate.set(line.vatBp, (byRate.get(line.vatBp) ?? 0) + line.totalCents - line.discountCents);
  if (deliveryCents > 0)
    byRate.set(rules.vatRates.standard, (byRate.get(rules.vatRates.standard) ?? 0) + deliveryCents);
  const vatBreakdown = vatByRate(byRate);
  const totalCents = goodsCents + deliveryCents;

  // Step 6: loyalty points as a means of payment: whole points only, never more than the total.
  const value = rules.loyalty?.pointValueCents ?? 0;
  const loyaltyPointsUsed =
    value > 0 ? Math.max(0, Math.min(input.loyaltyPoints ?? 0, Math.floor(totalCents / value))) : 0;
  const loyaltyCents = loyaltyPointsUsed * value;

  // Step 7: gift cards in the order given, each capped at what is left.
  let left = totalCents - loyaltyCents;
  const giftCards: Quote['giftCards'] = [];
  const giftCardsRejected: Quote['giftCardsRejected'] = [];
  for (const card of input.giftCards ?? []) {
    if (card.active === false) giftCardsRejected.push({ code: card.code, reason: 'GIFT_CARD_VOID' });
    else if (time(card.expiresAt) !== null && now.getTime() > (time(card.expiresAt) as number))
      giftCardsRejected.push({ code: card.code, reason: 'GIFT_CARD_EXPIRED' });
    else if (card.balanceCents <= 0) giftCardsRejected.push({ code: card.code, reason: 'GIFT_CARD_EMPTY' });
    else if (left > 0) {
      const amountCents = Math.min(card.balanceCents, left);
      giftCards.push({ code: card.code, amountCents });
      left -= amountCents;
    }
  }

  return {
    lines,
    subtotalCents,
    promotionCents: add(...lines.map((l) => l.promoCents)),
    discountCents,
    deliveryCents,
    vatCents: add(...vatBreakdown.map((v) => v.vatCents)),
    totalCents,
    vatBreakdown,
    promotions: [...new Set(lines.map((l) => l.promotion).filter((p): p is string => p !== null))],
    code,
    codeRejected,
    loyaltyPointsUsed,
    loyaltyCents,
    giftCards,
    giftCardsRejected,
    // Step 8: what is left to pay, never below zero.
    amountDueCents: Math.max(0, left),
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
export function priceDocument(
  lines: DocumentLineInput[],
  discount: DocumentDiscount = { kind: 'none' },
): PricedDocument {
  const totals = lines.map((line) => {
    if (!(line.qty > 0)) throw new Error(`priceDocument: quantity ${line.qty} is not positive`);
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0)
      throw new Error(`priceDocument: price ${line.unitPriceCents} is not whole cents ≥ 0`);
    return divRound(line.unitPriceCents * Math.round(line.qty * 100), 100);
  });
  const subtotalCents = add(...totals);
  const value = discount.value ?? 0;
  const discountCents =
    discount.kind === 'percent' ? pct(subtotalCents, value) : discount.kind === 'amount' ? value : 0;
  if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents)
    throw new Error('discount');

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
