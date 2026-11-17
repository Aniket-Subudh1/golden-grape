import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import type { Tx } from '@/lib/tx';
import type { Order } from '@/payload-types';
import { cardCode, monthsAfter, normalizeCode } from './codes';
import { earnedPoints, expirable } from './loyalty';
import type { GiftCardInput, GiftCardRejection } from './pricing';

// Loyalty points and gift cards around an order (M3.2 T3). Balances are caches of their ledgers, moved only by
// conditional `$inc` in the order's (or the job's) transaction; every move writes its ledger row in the same one.

const idOf = (v: unknown) =>
  typeof v === 'object' && v !== null ? String((v as { id: string }).id) : v ? String(v) : null;

type Settings = Awaited<ReturnType<Payload['findGlobal']>> & {
  modules?: { loyalty?: boolean | null; giftCards?: boolean | null } | null;
  loyalty?: {
    pointsPerEuro?: number | null;
    pointValueCents?: number | null;
    expiryMonths?: number | null;
    eligibleChannels?: string[] | null;
  } | null;
  giftCards?: { validityMonths?: number | null } | null;
};

async function settingsOf(tx: Tx | Payload) {
  const payload = 'req' in tx ? tx.req.payload : tx;
  const s = (await payload.findGlobal({
    slug: 'BusinessSettings',
    depth: 0,
    overrideAccess: true,
    ...('req' in tx ? { req: tx.req } : {}),
  })) as Settings;
  return {
    loyaltyOn: s.modules?.loyalty === true,
    giftCardsOn: s.modules?.giftCards === true,
    pointsPerEuro: s.loyalty?.pointsPerEuro ?? 1,
    pointValueCents: s.loyalty?.pointValueCents ?? 5,
    expiryMonths: s.loyalty?.expiryMonths ?? 24,
    channels: s.loyalty?.eligibleChannels ?? ['webshop', 'mobile'],
    validityMonths: s.giftCards?.validityMonths ?? 24,
  };
}

const ledger = (tx: Tx, data: Record<string, unknown>) =>
  tx.req.payload.create({
    collection: 'loyaltyLedger',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    context: { byService: true },
    data: data as never,
  });
const cardLedger = (tx: Tx, data: Record<string, unknown>) =>
  tx.req.payload.create({
    collection: 'giftCardLedger',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    context: { byService: true },
    data: data as never,
  });

// ---- Pricing inputs (step 6–7 of quote) ---------------------------------------------------------------------------

/** The point value and the most points this customer may use (their balance), when loyalty is on. */
export async function loyaltyFor(payload: Payload, customer: { id: string } | null | undefined, wanted: number | 'all' | undefined) {
  const none = { rule: null, points: 0, balance: 0, valueCents: 0 };
  if (!customer) return none;
  const s = await settingsOf(payload);
  if (!s.loyaltyOn) return none;
  const doc = await payload.findByID({ collection: 'customers', id: customer.id, depth: 0, overrideAccess: true, disableErrors: true, select: { loyaltyBalance: true } });
  const balance = doc?.loyaltyBalance ?? 0;
  const points = !wanted ? 0 : wanted === 'all' ? balance : Math.min(balance, Math.max(0, Math.floor(wanted)));
  return { rule: { pointValueCents: s.pointValueCents }, points, balance, valueCents: s.pointValueCents };
}

/** Typed gift card codes as `quote` reads them, in the order typed; unknown codes come back apart. */
export async function giftCardsFor(payload: Payload, typed: string[] | undefined) {
  const codes = [...new Set((typed ?? []).map(normalizeCode).filter(Boolean))];
  if (codes.length === 0)
    return { cards: [] as GiftCardInput[], unknown: [] as { code: string; reason: GiftCardRejection }[] };
  if (!(await settingsOf(payload)).giftCardsOn)
    return { cards: [], unknown: codes.map((code) => ({ code, reason: 'GIFT_CARD_UNKNOWN' as const })) };
  const { docs } = await payload.find({
    collection: 'giftCards',
    where: { code: { in: codes } },
    depth: 0,
    limit: codes.length,
    overrideAccess: true,
    pagination: false,
  });
  const byCode = new Map(docs.map((d) => [d.code, d]));
  return {
    cards: codes
      .filter((c) => byCode.has(c))
      .map((c) => ({
        code: c,
        balanceCents: byCode.get(c)!.balanceCents ?? 0,
        expiresAt: byCode.get(c)!.expiresAt,
        active: byCode.get(c)!.status !== 'void',
      })),
    unknown: codes.filter((c) => !byCode.has(c)).map((code) => ({ code, reason: 'GIFT_CARD_UNKNOWN' as const })),
  };
}

// ---- Spending (inside the order transaction) ---------------------------------------------------------------------

/** The points and gift card amounts the quote applies, taken now; a balance spent meanwhile → CONFLICT. */
export async function spend(
  tx: Tx,
  q: { loyaltyPointsUsed: number; giftCards: { code: string; amountCents: number }[] },
  { order, customer }: { order: string; customer?: string | null },
) {
  if (q.loyaltyPointsUsed > 0) {
    if (!customer) throw new AppError('VALIDATION', 'loyaltyNeedsAccount', 'loyalty');
    const claim = await tx
      .model('customers')
      .updateOne(
        { _id: customer, loyaltyBalance: { $gte: q.loyaltyPointsUsed } },
        { $inc: { loyaltyBalance: -q.loyaltyPointsUsed } },
        { session: tx.session },
      );
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'LOYALTY_SPENT', 'loyalty');
    await ledger(tx, { customer, points: -q.loyaltyPointsUsed, type: 'redeem', order });
  }
  for (const card of q.giftCards) {
    const claim = await tx
      .model('giftCards')
      .updateOne(
        {
          code: card.code,
          status: 'active',
          balanceCents: { $gte: card.amountCents },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        },
        { $inc: { balanceCents: -card.amountCents } },
        { session: tx.session },
      );
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'GIFT_CARD_SPENT', 'giftCard');
    const doc = await tx
      .model('giftCards')
      .findOne({ code: card.code }, { _id: 1 }, { session: tx.session })
      .lean<{ _id: unknown }>();
    await cardLedger(tx, { card: String(doc!._id), amountCents: -card.amountCents, type: 'redeem', order });
  }
}

/** A cancelled or refunded order gives back the gift card amounts and points it used, once. */
export async function giveBack(tx: Tx, order: Order, user?: string) {
  const id = order.id;
  for (const card of order.pricing?.giftCards ?? []) {
    const doc = await tx
      .model('giftCards')
      .findOne({ code: card.code }, { _id: 1 }, { session: tx.session })
      .lean<{ _id: unknown }>();
    if (!doc || !card.amountCents) continue;
    const done = await tx
      .model('giftCardLedger')
      .countDocuments({ card: doc._id, order: id, type: 'refund' }, { session: tx.session });
    if (done > 0) continue;
    await tx
      .model('giftCards')
      .updateOne({ _id: doc._id }, { $inc: { balanceCents: card.amountCents } }, { session: tx.session });
    await cardLedger(tx, { card: String(doc._id), amountCents: card.amountCents, type: 'refund', order: id, user });
  }
  const points = order.pricing?.loyaltyPoints ?? 0;
  const customer = idOf(order.customer);
  if (points > 0 && customer) {
    const done = await tx
      .model('loyaltyLedger')
      .countDocuments({ order: id, type: 'adjust', points: { $gt: 0 } }, { session: tx.session });
    if (done === 0) {
      const s = await settingsOf(tx);
      await tx
        .model('customers')
        .updateOne({ _id: customer }, { $inc: { loyaltyBalance: points } }, { session: tx.session });
      await ledger(tx, {
        customer,
        points,
        type: 'adjust',
        order: id,
        reason: 'order cancelled or refunded: points given back',
        user,
        expiresAt: monthsAfter(new Date(), s.expiryMonths).toISOString(),
      });
    }
  }
}

// ---- Earning (completed) and taking back (refunded) --------------------------------------------------------------

/** Points for a completed order (A-08): its customer, an eligible channel, once per order. */
export async function earn(tx: Tx, order: Order) {
  const customer = idOf(order.customer);
  if (!customer) return;
  const s = await settingsOf(tx);
  if (!s.loyaltyOn || !s.channels.includes(order.channel ?? 'webshop')) return;
  if ((await tx.model('loyaltyLedger').countDocuments({ order: order.id, type: 'earn' }, { session: tx.session })) > 0)
    return;
  const variants = (order.lines ?? []).map((l) => idOf(l.variant)) as string[];
  const { docs } = await tx.req.payload.find({
    collection: 'variants',
    where: { id: { in: variants } },
    depth: 1,
    limit: variants.length,
    overrideAccess: true,
    pagination: false,
    req: tx.req,
    select: { product: true },
  });
  const earns = new Map(
    docs.map((v) => [
      v.id,
      !(typeof v.product === 'object' && v.product && (v.product.loyaltyExcluded || v.product.giftCard)),
    ]),
  );
  const points = earnedPoints(
    (order.lines ?? []).map((l) => ({
      totalCents: l.totalCents,
      discountCents: l.discountCents ?? 0,
      earns: earns.get(idOf(l.variant) as string) ?? false,
    })),
    order.pricing?.loyaltyCents ?? 0,
    s.pointsPerEuro,
  );
  if (points <= 0) return;
  await tx
    .model('customers')
    .updateOne({ _id: customer }, { $inc: { loyaltyBalance: points } }, { session: tx.session });
  await ledger(tx, {
    customer,
    points,
    type: 'earn',
    order: order.id,
    expiresAt: monthsAfter(new Date(), s.expiryMonths).toISOString(),
  });
}

/** A refunded order takes back the points it earned, as far as the customer still has them (never below 0). */
export async function takeBack(tx: Tx, order: Order, user?: string) {
  const customer = idOf(order.customer);
  if (!customer) return;
  const rows = await tx
    .model('loyaltyLedger')
    .find(
      { order: order.id, type: { $in: ['earn', 'adjust'] } },
      { points: 1, type: 1, reason: 1 },
      { session: tx.session },
    )
    .lean<{ points: number; type: string; reason?: string }[]>();
  const earned = rows.filter((r) => r.type === 'earn').reduce((s, r) => s + r.points, 0);
  const taken = -rows.filter((r) => r.type === 'adjust' && r.points < 0).reduce((s, r) => s + r.points, 0);
  const left = earned - taken;
  if (left <= 0) return;
  const doc = await tx
    .model('customers')
    .findOne({ _id: customer }, { loyaltyBalance: 1 }, { session: tx.session })
    .lean<{ loyaltyBalance?: number }>();
  const points = Math.min(left, doc?.loyaltyBalance ?? 0);
  if (points <= 0) return;
  await tx
    .model('customers')
    .updateOne(
      { _id: customer, loyaltyBalance: { $gte: points } },
      { $inc: { loyaltyBalance: -points } },
      { session: tx.session },
    );
  await ledger(tx, {
    customer,
    points: -points,
    type: 'adjust',
    order: order.id,
    reason: 'order refunded: points earned taken back',
    user,
  });
}

// ---- Gift cards sold online -------------------------------------------------------------------------------------

/**
 * One card per unit of each gift-card line, when the order is confirmed (with its stock: postSale), once per order.
 * The amount is the size's face value; the code goes to the buyer by e-mail after commit (mailGiftCards).
 */
export async function issueForOrder(tx: Tx, order: Order) {
  const s = await settingsOf(tx);
  if (!s.giftCardsOn || (order.lines ?? []).length === 0) return 0;
  if ((await tx.model('giftCards').countDocuments({ order: order.id }, { session: tx.session })) > 0) return 0;
  const variants = (order.lines ?? []).map((l) => idOf(l.variant)) as string[];
  const { docs } = await tx.req.payload.find({
    collection: 'variants',
    where: { id: { in: variants } },
    depth: 1,
    limit: variants.length,
    overrideAccess: true,
    pagination: false,
    req: tx.req,
    select: { product: true, priceCents: true },
  });
  let issued = 0;
  for (const line of order.lines ?? []) {
    const v = docs.find((d) => d.id === idOf(line.variant));
    if (!v || !(typeof v.product === 'object' && v.product?.giftCard)) continue;
    for (let i = 0; i < (line.baseQty ?? line.unitQty); i++) {
      const card = await tx.req.payload.create({
        collection: 'giftCards',
        req: tx.req,
        overrideAccess: true,
        depth: 0,
        context: { byService: true },
        data: {
          code: cardCode(),
          initialCents: v.priceCents,
          balanceCents: v.priceCents,
          status: 'active',
          expiresAt: monthsAfter(new Date(), s.validityMonths).toISOString(),
          purchaser: idOf(order.customer) ?? undefined,
          recipientEmail: order.contact?.email,
          recipientName: order.contact?.name,
          order: order.id,
          locale: order.locale ?? 'fr',
        },
      });
      await cardLedger(tx, { card: card.id, amountCents: v.priceCents, type: 'issue', order: order.id });
      issued += 1;
    }
  }
  return issued;
}

// ---- Expiry (daily job) -------------------------------------------------------------------------------------------

/** Writes an `expire` row for each lot past its date with points left (FIFO), and lowers the balance. */
export async function expirePoints(payload: Payload, now = new Date()) {
  const { withTx } = await import('@/lib/tx');
  const { docs } = await payload.find({
    collection: 'customers',
    where: { loyaltyBalance: { greater_than: 0 } },
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    select: { loyaltyBalance: true },
  });
  let expired = 0;
  for (const c of docs) {
    expired += await withTx(payload, async (tx) => {
      const rows = await tx
        .model('loyaltyLedger')
        .find({ customer: c.id }, { points: 1, createdAt: 1, expiresAt: 1 }, { session: tx.session })
        .lean<{ _id: unknown; points: number; createdAt: Date; expiresAt?: Date }[]>();
      const lots = expirable(
        rows.map((r) => ({ id: String(r._id), points: r.points, at: r.createdAt, expiresAt: r.expiresAt ?? null })),
        now,
      );
      const points = lots.reduce((s, l) => s + l.points, 0);
      if (points <= 0) return 0;
      const claim = await tx
        .model('customers')
        .updateOne(
          { _id: c.id, loyaltyBalance: { $gte: points } },
          { $inc: { loyaltyBalance: -points } },
          { session: tx.session },
        );
      if (claim.matchedCount === 0) return 0;
      await ledger(tx, {
        customer: c.id,
        points: -points,
        type: 'expire',
        reason: `${lots.length} lot(s) past their date`,
      });
      return points;
    });
  }
  return expired;
}
