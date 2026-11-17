import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { addDays, fromLocal, today } from '@/lib/time';
import { withTx } from '@/lib/tx';
import type { VatClass } from '@/modules/promotions/pricing';
import { quoteCart, vatRates } from '@/modules/promotions/service';
import { placeStaffOrder, type Priced } from '@/modules/sales/service';
import type { Quotation } from '@/payload-types';
import { isExpired, sendQuotation } from './service';

// B2B product quotations (M3.2 T5): priced by `quote` for the customer (their list, promotions) on the mobile channel,
// kept as priced, sent with the catering quotations' numbering, PDF and signature link. Once accepted (by the customer
// online, or by staff on the phone), "Create order" places the order at the quoted prices, once.

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as { id: string }).id) : v ? String(v) : null);
const noonOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return fromLocal(y, m, d, 12).toISOString();
};

/** A quotation for a customer from catalogue lines, priced now, sent at once (number, PDF, e-mail). */
export async function createB2bQuotation(payload: Payload, input: { customer: string; lines: { variant: string; unit?: string; qty: number }[] }, { now = new Date() }: { now?: Date } = {}) {
  if (input.lines.length === 0) throw new AppError('VALIDATION', 'emptyCart', 'lines');
  const customer = await payload.findByID({ collection: 'customers', id: input.customer, depth: 0, overrideAccess: true, disableErrors: true });
  if (!customer) throw new AppError('NOT_FOUND', 'customer', 'customer');
  const locale = (customer.locale ?? 'fr') as Locale;
  const [q, rates, settings] = await Promise.all([quoteCart(payload, input.lines, { customer, channel: 'mobile', locale }), vatRates(), payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true, locale })]);
  if (q.notices.length > 0) throw new AppError('OUT_OF_STOCK', 'cartChanged', 'lines');
  const classOf = (bp: number) => (Object.entries(rates).find(([, r]) => r === bp)?.[0] ?? 'standard') as VatClass;
  const draft = await payload.create({
    collection: 'quotations',
    overrideAccess: true,
    depth: 0,
    data: {
      kind: 'b2b',
      status: 'draft',
      title: `Brouillon · ${customer.company || customer.name}`,
      customer: customer.id,
      contact: { name: customer.name, email: customer.email, phone: customer.phone ?? undefined, company: customer.company ?? undefined },
      lines: q.lines.map((l) => ({
        description: l.name,
        detail: l.detail ?? undefined,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        vat: classOf(l.vatBp),
        vatBp: l.vatBp,
        discountCents: l.promoCents + l.discountCents,
        totalCents: l.totalCents - l.discountCents,
        variant: l.variant,
        unit: l.unit,
      })),
      totals: { subtotalCents: q.subtotalCents + q.promotionCents, discountCents: q.promotionCents + q.discountCents, vatCents: q.vatCents, totalCents: q.totalCents, vatBreakdown: q.vatBreakdown },
      conditions: settings.quotationConditions ?? undefined,
      validUntil: noonOf(addDays(today(now), settings.quotationValidityDays ?? 30)),
      locale,
    },
  });
  return sendQuotation(payload, draft.id, { now });
}

/** A B2B quotation's lines and totals as an order's price (the quotation's own numbers, never re-priced). */
async function pricedOf(payload: Payload, q: Quotation): Promise<Priced> {
  const units = (q.lines ?? []).map((l) => idOf(l.unit)).filter(Boolean) as string[];
  const { docs } = units.length ? await payload.find({ collection: 'packagingUnits', where: { id: { in: units } }, depth: 0, limit: units.length, overrideAccess: true, pagination: false }) : { docs: [] };
  const factor = new Map(docs.map((u) => [u.id, u.factor]));
  const totals = q.totals!;
  return {
    lines: (q.lines ?? []).map((l) => ({
      variant: idOf(l.variant)!,
      unit: idOf(l.unit) ?? undefined,
      qty: l.qty,
      baseQty: l.qty * (factor.get(idOf(l.unit) ?? '') ?? 1),
      name: l.description,
      detail: l.detail ?? null,
      unitPriceCents: l.unitPriceCents,
      promoCents: l.discountCents ?? 0,
      discountCents: 0,
      vatBp: l.vatBp ?? 0,
      totalCents: l.totalCents ?? 0,
    })),
    subtotalCents: (totals.subtotalCents ?? 0) - (totals.discountCents ?? 0),
    promotionCents: totals.discountCents ?? 0,
    discountCents: 0,
    deliveryCents: 0,
    vatCents: totals.vatCents ?? 0,
    totalCents: totals.totalCents ?? 0,
    vatBreakdown: (totals.vatBreakdown ?? []).map((v) => ({ rateBp: v.rateBp ?? 0, baseCents: v.baseCents ?? 0, vatCents: v.vatCents ?? 0 })),
    code: null,
    codeRejected: null,
    promotions: [],
    loyaltyPointsUsed: 0,
    loyaltyCents: 0,
    giftCards: [],
    giftCardsRejected: [],
    amountDueCents: totals.totalCents ?? 0,
    notices: [],
  };
}

/**
 * "Create order" on a B2B quotation (AC-M3.2-02): accepted by the customer, or accepted now by staff on their word; an
 * expired one cannot. The order is placed at the quoted prices ("invoice later"), once: a second click returns it.
 */
export async function orderFromQuotation(payload: Payload, quotationId: string, { staff, staffName, now = new Date() }: { staff: string; staffName: string; now?: Date }) {
  const q = await payload.findByID({ collection: 'quotations', id: quotationId, depth: 0, overrideAccess: true, disableErrors: true });
  if (!q || q.kind !== 'b2b') throw new AppError('NOT_FOUND', 'quotation');
  if (q.order) return { order: idOf(q.order)!, quotation: q };
  if (isExpired(q, now) || q.status === 'expired' || q.status === 'declined') throw new AppError('CONFLICT', 'quotationClosed', 'status');
  if (q.status === 'sent' || q.status === 'viewed') {
    await withTx(payload, async (tx) => {
      const claim = await tx.model('quotations').updateOne({ _id: q.id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'accepted', acceptedAt: now, 'signature.name': `${staffName} (équipe)`, 'signature.at': now } }, { session: tx.session });
      if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'transition', 'status');
    });
  } else if (q.status !== 'accepted') throw new AppError('CONFLICT', 'quotationClosed', 'status');
  const placed = await placeStaffOrder(
    payload,
    { idempotencyKey: `quotation:${q.id}`, customer: idOf(q.customer)!, lines: (q.lines ?? []).map((l) => ({ variant: idOf(l.variant)!, unit: idOf(l.unit) ?? undefined, qty: l.qty })), payment: 'invoice', notes: q.number ?? undefined },
    { staff, now, priced: await pricedOf(payload, q) },
  );
  const linked = await payload.update({ collection: 'quotations', id: q.id, data: { order: placed.id }, overrideAccess: true, depth: 0 });
  return { order: placed.id, quotation: linked };
}
