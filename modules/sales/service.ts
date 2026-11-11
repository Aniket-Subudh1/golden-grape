import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Payload } from 'payload';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { addDays, today } from '@/lib/time';
import { model, type Tx, withTx } from '@/lib/tx';
import { postMovements } from '@/modules/inventory/service';
import { provider } from '@/modules/payments/provider';
import { dueOf, type Figures, paymentState, refundableOf } from '@/modules/payments/service';
import { quoteCart } from '@/modules/promotions/service';
import { NUMBERING } from '@/modules/settings/globals';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { Customer, Order, Reservation, SlotRule as SlotRuleDoc } from '@/payload-types';
import type { SlotMode } from './collections';
import { canTransition, effects as effectsOf, type Effect, type OrderStatus, PAYMENT_CHOICES, type PaymentChoice } from './order-states';
import { generateSlots, type Hours, type Slot } from './slots';
import { deliveryFee, resolveZone } from './zones';

export { normalizePostalCode } from './zones';

// Checkout, orders and their state changes (02 §6, M2.3 T4). The action layer validates input with zod and sends
// the e-mails after commit; everything that must be true at once (slot capacity, zone, prices, stock, numbering)
// happens here, inside one transaction.

const idOf = (value: unknown) => (typeof value === 'object' && value !== null ? (value as { id: string }).id : String(value));

/** Orders that no longer hold their slot. */
const RELEASED: OrderStatus[] = ['cancelled', 'refunded'];
/** Reservations that hold their table. */
const HOLDING = ['pending', 'accepted'];

// ---------------------------------------------------------------------------------------------------------------
// Slots

type SlotContext = { rule: SlotRuleDoc; hours: Hours; closedDates: string[] };

async function slotContext(payload: Payload, mode: SlotMode): Promise<SlotContext | null> {
  const [{ docs }, settings] = await Promise.all([
    payload.find({ collection: 'slotRules', where: { mode: { equals: mode } }, limit: 1, depth: 0, overrideAccess: true }),
    getSettingsPrivate(),
  ]);
  if (!docs[0]) return null;
  return {
    rule: docs[0],
    hours: (settings.hours ?? []) as Hours,
    closedDates: (settings.closedDates ?? []).map((c) => today(new Date(c.date))),
  };
}

/** What is already taken per `date` and start time: orders for pickup and delivery, guests for tables. */
async function takenBetween(payload: Payload, mode: SlotMode, from: string, to: string, tx?: Tx): Promise<Record<string, Record<string, number>>> {
  const session = tx ? { session: tx.session } : {};
  const rows =
    mode === 'table'
      ? await model(payload, 'reservations').aggregate<{ _id: { date: string; from: string }; n: number }>(
          [{ $match: { 'slot.date': { $gte: from, $lte: to }, status: { $in: HOLDING } } }, { $group: { _id: { date: '$slot.date', from: '$slot.from' }, n: { $sum: '$guests' } } }],
          session,
        )
      : await model(payload, 'orders').aggregate<{ _id: { date: string; from: string }; n: number }>(
          [{ $match: { mode, 'slot.date': { $gte: from, $lte: to }, status: { $nin: RELEASED } } }, { $group: { _id: { date: '$slot.date', from: '$slot.from' }, n: { $sum: 1 } } }],
          session,
        );
  const taken: Record<string, Record<string, number>> = {};
  for (const r of rows) (taken[r._id.date] ??= {})[r._id.from] = r.n;
  return taken;
}

const ruleOf = (ctx: SlotContext) => ({ ...ctx.rule, days: (ctx.rule.days ?? []) as Hours });

export type SlotDay = { date: string; slots: Slot[] };

/** Every bookable day of a mode with its slots (days without any slot are left out), for the slot picker. */
export async function slotCalendar(payload: Payload, mode: SlotMode, now = new Date()): Promise<SlotDay[]> {
  const ctx = await slotContext(payload, mode);
  if (!ctx) return [];
  const first = today(now);
  const dates = Array.from({ length: ctx.rule.maxDaysAhead + 1 }, (_, i) => addDays(first, i));
  const taken = await takenBetween(payload, mode, first, dates[dates.length - 1]);
  return dates
    .map((date) => ({ date, slots: generateSlots({ date, rule: ruleOf(ctx), hours: ctx.hours, closedDates: ctx.closedDates, now, taken: taken[date] ?? {} }) }))
    .filter((d) => d.slots.length > 0);
}

/**
 * Takes one slot inside the transaction: bumps the mode's rule first (two bookings of one mode now conflict and the
 * later one retries), then recounts. Throws CONFLICT when the slot is full or gone.
 */
async function takeSlot(tx: Tx, mode: SlotMode, date: string, from: string, need: number, now: Date): Promise<Slot> {
  const payload = tx.req.payload;
  const lock = await tx.model('slotRules').updateOne({ mode }, { $inc: { lockVersion: 1 } }, { session: tx.session });
  if (lock.matchedCount === 0) throw new AppError('VALIDATION', 'slotUnavailable', 'slot');
  const ctx = await slotContext(payload, mode);
  if (!ctx) throw new AppError('VALIDATION', 'slotUnavailable', 'slot');
  const taken = await takenBetween(payload, mode, date, date, tx);
  const slot = generateSlots({ date, rule: ruleOf(ctx), hours: ctx.hours, closedDates: ctx.closedDates, now, taken: taken[date] ?? {} }).find((s) => s.from === from);
  if (!slot) throw new AppError('VALIDATION', 'slotUnavailable', 'slot');
  if (slot.available < need) throw new AppError('CONFLICT', 'slotFull', 'slot');
  return slot;
}

// ---------------------------------------------------------------------------------------------------------------
// Delivery zones

/** The active delivery zone of a postcode, or null (checkout then suggests pickup). */
export async function zoneFor(payload: Payload, postalCode: string, tx?: Tx) {
  const { docs } = await payload.find({ collection: 'deliveryZones', where: { active: { equals: true } }, limit: 0, depth: 0, overrideAccess: true, ...(tx ? { req: tx.req } : {}) });
  return resolveZone(postalCode, docs.map((z) => ({ ...z, postalCodes: z.postalCodes ?? [] })));
}

// ---------------------------------------------------------------------------------------------------------------
// Guest access to the confirmation page

const sign = (id: string) => createHmac('sha256', env.PAYLOAD_SECRET).update(`order:${id}`).digest('base64url').slice(0, 32);

/** The token that opens `/order/[id]` without an account (an HMAC of the id). */
export const orderToken = (id: string) => sign(id);

export function checkOrderToken(id: string, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(sign(id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------------------------------------------
// Placing an order

export type PlaceOrderInput = {
  idempotencyKey: string;
  mode: SlotMode;
  lines: { variant: string; unit?: string; qty: number }[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  address?: { line1: string; line2?: string; postalCode: string; city: string };
  guests?: number;
  preorder?: boolean;
  payment: PaymentChoice;
  notes?: string;
  locale: Locale;
};

export type Placed = { kind: 'order' | 'reservation'; id: string; number: string; created: boolean };

/** The order or reservation already placed with this key (sequential reads: one transaction session runs one at a time). */
async function findPlaced(payload: Payload, key: string, tx?: Tx): Promise<Placed | null> {
  const where = { idempotencyKey: { equals: key } };
  const opts = { limit: 1, depth: 0, overrideAccess: true, ...(tx ? { req: tx.req } : {}) } as const;
  const reservation = (await payload.find({ collection: 'reservations', where, ...opts })).docs[0];
  if (reservation) return { kind: 'reservation', id: reservation.id, number: reservation.number ?? '', created: false };
  const order = (await payload.find({ collection: 'orders', where, ...opts })).docs[0];
  if (order) return { kind: 'order', id: order.id, number: order.number ?? '', created: false };
  return null;
}

/**
 * Places a pickup or delivery order, or books a table (with an optional pre-order), exactly as 02 §6:
 * duplicate key → the existing one; server prices via `quote`; the slot recounted in the transaction; zone and
 * minimum for delivery; insert `pending`; the payment provider decides `confirmed` or `awaiting_payment`; a confirmed
 * order posts its sale movements in the same transaction. A table and its pre-order wait for staff (no stock moves).
 */
export async function placeOrder(payload: Payload, input: PlaceOrderInput, { customer, now = new Date() }: { customer?: Customer | null; now?: Date } = {}): Promise<Placed> {
  const existing = await findPlaced(payload, input.idempotencyKey);
  if (existing) return existing;
  if (!PAYMENT_CHOICES[input.mode].includes(input.payment)) throw new AppError('VALIDATION', 'invalid', 'payment');
  const withLines = input.mode !== 'table' || input.preorder === true;
  if (withLines && input.lines.length === 0) throw new AppError('VALIDATION', 'emptyCart', 'lines');
  if (input.mode === 'table' && !input.guests) throw new AppError('VALIDATION', 'required', 'guests');
  if (input.mode === 'delivery' && !input.address) throw new AppError('VALIDATION', 'required', 'line1');

  try {
    return await withTx(payload, async (tx) => {
      const again = await findPlaced(payload, input.idempotencyKey, tx);
      if (again) return again;
      const slot = await takeSlot(tx, input.mode, input.date, input.time, input.mode === 'table' ? (input.guests ?? 1) : 1, now);

      const zone = input.mode === 'delivery' ? await zoneFor(payload, input.address!.postalCode, tx) : null;
      if (input.mode === 'delivery' && !zone) throw new AppError('VALIDATION', 'outsideZone', 'postalCode');
      const q = withLines
        ? await quoteCart(payload, input.lines, { customer, channel: 'webshop', locale: input.locale, delivery: zone })
        : null;
      // The cart changed since it was shown (stock, availability): the visitor sees it corrected before paying.
      if (q && q.notices.length > 0) throw new AppError('OUT_OF_STOCK', 'cartChanged', 'lines');
      // A table's pre-order holds only the counter's dishes and drinks: a shop purchase is never booked as a table
      // (APPLUX audit 10 Nov, §1). The checkout sends only those; this is the rule, not a convenience.
      if (q && input.mode === 'table' && q.lines.some((l) => l.kind !== 'snack')) throw new AppError('VALIDATION', 'notPreorderable', 'lines');
      if (q && zone && deliveryFee(zone, q.subtotalCents - q.discountCents).belowMinimum) throw new AppError('VALIDATION', 'belowMinimum', 'postalCode');

      const { numbering } = await getSettingsPrivate();
      const year = Number(today(now).slice(0, 4));
      const slotData = { date: input.date, from: slot.from, to: slot.to };
      const contact = { name: input.name, email: input.email.toLowerCase(), phone: input.phone };

      let order: Order | null = null;
      if (q) {
        const n = await nextNumber(tx, 'order', year);
        order = await payload.create({
          collection: 'orders',
          req: tx.req,
          overrideAccess: true,
          depth: 0,
          data: {
            number: formatNumber(numbering?.order ?? NUMBERING.order, year, n),
            idempotencyKey: input.mode === 'table' ? `${input.idempotencyKey}:preorder` : input.idempotencyKey,
            status: 'pending',
            channel: 'webshop',
            mode: input.mode,
            customer: customer?.id,
            contact,
            address: input.mode === 'delivery' ? { ...input.address, country: 'LU' } : undefined,
            slot: slotData,
            slotAt: `${input.date}T${slot.from}`,
            lines: q.lines.map((l) => ({
              variant: l.variant,
              unit: l.unit,
              unitQty: l.qty,
              baseQty: l.baseQty,
              name: l.name,
              detail: l.detail,
              unitPriceCents: l.unitPriceCents,
              discountCents: l.discountCents,
              vatBp: l.vatBp,
              totalCents: l.totalCents,
            })),
            totals: { subtotalCents: q.subtotalCents, discountCents: q.discountCents, deliveryCents: q.deliveryCents, vatCents: q.vatCents, totalCents: q.totalCents, vatBreakdown: q.vatBreakdown },
            payment: { provider: 'manual', method: input.payment, status: 'none' },
            locale: input.locale,
            notes: input.notes,
            stockPosted: false,
          },
        });
      }

      if (input.mode === 'table') {
        const n = await nextNumber(tx, 'reservation', year);
        const reservation = await payload.create({
          collection: 'reservations',
          req: tx.req,
          overrideAccess: true,
          depth: 0,
          data: {
            number: formatNumber(numbering?.reservation ?? NUMBERING.reservation, year, n),
            idempotencyKey: input.idempotencyKey,
            status: 'pending',
            customer: customer?.id,
            contact,
            slot: slotData,
            slotAt: `${input.date}T${slot.from}`,
            guests: input.guests ?? 1,
            preorder: order?.id,
            notes: input.notes,
            locale: input.locale,
          },
        });
        return { kind: 'reservation', id: reservation.id, number: reservation.number ?? '', created: true };
      }

      const started = await provider(order!.payment?.provider).start(tx, order!);
      await setOrder(tx, order!.id, { status: started.status, payment: { ...order!.payment, status: started.paymentStatus } });
      if (started.status === 'confirmed') await postSale(tx, order!);
      return { kind: 'order', id: order!.id, number: order!.number ?? '', created: true };
    });
  } catch (error) {
    // Two submits with one key raced past the first check: the loser hits the unique index. Same answer as a reload.
    const placed = await findPlaced(payload, input.idempotencyKey);
    if (placed) return placed;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// State changes

function setOrder(tx: Tx, id: string, data: Partial<Order>) {
  return tx.req.payload.update({ collection: 'orders', id, req: tx.req, overrideAccess: true, depth: 0, data });
}

/** Sale movements for the order's lines (`ref` = the order), once: guarded by `stockPosted`. */
async function postSale(tx: Tx, order: Order, user?: string) {
  const claim = await tx.model('orders').updateOne({ _id: order.id, stockPosted: { $ne: true } }, { $set: { stockPosted: true } }, { session: tx.session });
  if (claim.matchedCount === 0) return;
  await postMovements(
    tx,
    (order.lines ?? []).map((l) => ({
      variant: idOf(l.variant),
      unit: l.unit ? idOf(l.unit) : undefined,
      unitQty: -l.unitQty,
      type: 'sale' as const,
      channel: order.channel ?? 'webshop',
      ref: { relationTo: 'orders' as const, value: order.id },
      user,
    })),
  );
}

/** Puts back exactly what the sale took: the opposite of each sale movement of this order, found by `ref`. */
async function returnStock(tx: Tx, order: Order, user?: string, reason?: string) {
  const claim = await tx.model('orders').updateOne({ _id: order.id, stockPosted: true }, { $set: { stockPosted: false } }, { session: tx.session });
  if (claim.matchedCount === 0) return;
  const { docs } = await tx.req.payload.find({
    collection: 'stockMovements',
    where: { and: [{ 'ref.value': { equals: order.id } }, { 'ref.relationTo': { equals: 'orders' } }, { type: { equals: 'sale' } }] },
    limit: 0,
    depth: 0,
    req: tx.req,
    overrideAccess: true,
  });
  await postMovements(
    tx,
    docs.map((m) => ({
      variant: idOf(m.variant),
      unit: m.unit ? idOf(m.unit) : undefined,
      unitQty: -(m.unitQty ?? m.qty),
      type: 'cancel' as const,
      reason,
      channel: m.channel,
      ref: { relationTo: 'orders' as const, value: order.id },
      user,
    })),
  );
}

export type Transitioned = { order: Order; from: OrderStatus; effects: Effect[] };

/**
 * Moves an order to `to` inside the caller's transaction: refuses any move ORDER_FLOW does not list, claims the
 * change with a conditional update (of two clicks, the second is refused), runs the listed effects and the payment
 * bookkeeping, and records who did it.
 */
export async function applyTransition(tx: Tx, orderId: string, to: OrderStatus, { user, reason }: { user?: string; reason?: string } = {}): Promise<Transitioned> {
  const order = await tx.req.payload.findByID({ collection: 'orders', id: orderId, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
  if (!order) throw new AppError('NOT_FOUND', 'order');
  const from = (order.status ?? 'pending') as OrderStatus;
  if (!canTransition(from, to)) throw new AppError('CONFLICT', 'transition', 'status');
  const claim = await tx.model('orders').updateOne({ _id: order.id, status: from }, { $set: { status: to } }, { session: tx.session });
  if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'transition', 'status');

  const list = effectsOf(from, to);
  if (list.includes('postSale')) await postSale(tx, order, user);
  if (list.includes('returnStock')) await returnStock(tx, order, user, reason);

  // Money (GG-003/004). A move never invents a payment: a transfer counts only once recorded (recordPayment). Two
  // exceptions, both staff confirming money in hand: handing over an order paid on site records what was still due;
  // cancelling an order that was (partly) paid leaves that amount as a refund to send, with the cancel's reason.
  const pay = provider(order.payment?.provider);
  const money = figuresOf(order);
  let paymentStatus = order.payment?.status ?? 'none';
  if (to === 'completed' && order.payment?.method === 'onsite' && dueOf(money) > 0) {
    await pay.capture(tx, order, { amountCents: dueOf(money), at: new Date(), user });
    money.paidCents += dueOf(money);
  } else if (to === 'cancelled' && paymentStatus === 'authorized') {
    await pay.void(tx, order, user);
    paymentStatus = 'voided';
  }
  if (to === 'cancelled' && refundableOf(money) > 0) {
    money.refundDueCents = refundableOf(money);
  }
  if (paymentStatus !== 'voided' && paymentStatus !== 'authorized' && (paymentStatus !== 'none' || to === 'confirmed')) paymentStatus = paymentState(money);

  const updated = await setOrder(tx, order.id, {
    status: to,
    payment: {
      ...order.payment,
      status: paymentStatus,
      paidCents: money.paidCents,
      refundDueCents: money.refundDueCents,
      refundReason: to === 'cancelled' && money.refundDueCents > 0 ? (reason ?? order.payment?.refundReason) : order.payment?.refundReason,
    },
    history: [...(order.history ?? []), { at: new Date().toISOString(), from, to, user, reason }],
  });
  return { order: updated, from, effects: list };
}

/**
 * Staff move an order (admin buttons). A table's pre-order follows its reservation (reservations.ts), never alone.
 * The e-mail goes out after commit, from the action.
 */
export async function transition(payload: Payload, orderId: string, to: OrderStatus, ctx: { user?: string; reason?: string } = {}) {
  // "Refunded" follows the money (recordRefund), never a button (GG-004).
  if (to === 'refunded') throw new AppError('CONFLICT', 'transition', 'status');
  return withTx(payload, async (tx) => {
    const { totalDocs } = await payload.count({ collection: 'reservations', where: { preorder: { equals: orderId } }, req: tx.req, overrideAccess: true });
    if (totalDocs > 0) throw new AppError('CONFLICT', 'followsReservation', 'status');
    return applyTransition(tx, orderId, to, ctx);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Money staff record (GG-003, GG-004). Each runs in one transaction that rewrites the order, so two clicks at once
// conflict and the later one is retried against the new figures (and refused if the amount no longer fits).

const figuresOf = (order: Order): Figures => ({
  totalCents: order.totals?.totalCents ?? 0,
  paidCents: order.payment?.paidCents ?? 0,
  refundedCents: order.payment?.refundedCents ?? 0,
  refundDueCents: order.payment?.refundDueCents ?? 0,
});

async function loadOrder(tx: Tx, id: string) {
  const order = await tx.req.payload.findByID({ collection: 'orders', id, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
  if (!order) throw new AppError('NOT_FOUND', 'order');
  return order;
}

const historyRow = (to: string, user?: string, reason?: string) => ({ at: new Date().toISOString(), from: null, to, user, reason });

export type MoneyInput = { amountCents: number; at: Date; reference?: string; user?: string };
export type MoneyResult = { order: Order; effects: Effect[] };

/**
 * Money received from the customer (a transfer, a deposit, the rest). Refused above what is still due. Once the
 * whole amount is in, an order still waiting for its transfer is confirmed (stock out, e-mail).
 */
export function recordPayment(payload: Payload, orderId: string, input: MoneyInput): Promise<MoneyResult> {
  return withTx(payload, async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (order.status === 'cancelled' || order.status === 'refunded') throw new AppError('CONFLICT', 'transition', 'status');
    const money = figuresOf(order);
    if (input.amountCents <= 0 || input.amountCents > dueOf(money)) throw new AppError('VALIDATION', 'amountTooHigh', 'amount');
    await provider(order.payment?.provider).capture(tx, order, { ...input, method: order.payment?.method ?? undefined });
    money.paidCents += input.amountCents;
    let updated = await setOrder(tx, order.id, {
      payment: { ...order.payment, status: paymentState(money), paidCents: money.paidCents },
      history: [...(order.history ?? []), historyRow('payment', input.user, input.reference)],
    });
    let list: Effect[] = [];
    if (dueOf(money) === 0 && order.status === 'awaiting_payment') {
      const moved = await applyTransition(tx, order.id, 'confirmed', { user: input.user });
      updated = moved.order;
      list = moved.effects;
    }
    return { order: updated, effects: list };
  });
}

/** Staff decide to pay money back (amount and reason). Nothing is sent and no stock moves: it becomes a refund to do. */
export function requestRefund(payload: Payload, orderId: string, input: { amountCents: number; reason: string; user?: string }): Promise<MoneyResult> {
  return withTx(payload, async (tx) => {
    const order = await loadOrder(tx, orderId);
    const money = figuresOf(order);
    if (input.amountCents <= 0 || input.amountCents > refundableOf(money)) throw new AppError('VALIDATION', 'amountTooHigh', 'amount');
    money.refundDueCents = input.amountCents;
    const updated = await setOrder(tx, order.id, {
      payment: { ...order.payment, status: paymentState(money), refundDueCents: money.refundDueCents, refundReason: input.reason },
      history: [...(order.history ?? []), historyRow('refund_requested', input.user, input.reason)],
    });
    return { order: updated, effects: [] };
  });
}

/**
 * A refund actually sent (amount, the bank's date, method, reference, reason). Never moves stock: goods that come
 * back are a separate stock entry. Once everything received has gone back, a handed-over order becomes "refunded".
 */
export function recordRefund(payload: Payload, orderId: string, input: MoneyInput & { method: string; reason: string }): Promise<MoneyResult> {
  return withTx(payload, async (tx) => {
    const order = await loadOrder(tx, orderId);
    const money = figuresOf(order);
    if (input.amountCents <= 0 || input.amountCents > refundableOf(money)) throw new AppError('VALIDATION', 'amountTooHigh', 'amount');
    await provider(order.payment?.provider).refund(tx, order, input);
    money.refundedCents += input.amountCents;
    money.refundDueCents = Math.max(0, money.refundDueCents - input.amountCents);
    let updated = await setOrder(tx, order.id, {
      payment: { ...order.payment, status: paymentState(money), refundedCents: money.refundedCents, refundDueCents: money.refundDueCents },
      history: [...(order.history ?? []), historyRow('refund', input.user, input.reason)],
    });
    let list: Effect[] = [];
    if (refundableOf(money) === 0 && order.status === 'completed') {
      const moved = await applyTransition(tx, order.id, 'refunded', { user: input.user, reason: input.reason });
      updated = moved.order;
      list = moved.effects;
    }
    return { order: updated, effects: list };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Goods brought back (GG-042). A refund never moves stock (GG-004); what physically comes back is recorded here,
// line by line, as `return` movements on the order. Never more than was sold minus what already came back.

/** Units (of each line's own unit) already returned, by order line id. */
async function returnedOf(payload: Payload, order: Order, tx?: Tx) {
  const { docs } = await payload.find({
    collection: 'stockMovements',
    where: { and: [{ 'ref.value': { equals: order.id } }, { 'ref.relationTo': { equals: 'orders' } }, { type: { equals: 'return' } }] },
    limit: 0,
    depth: 0,
    ...(tx ? { req: tx.req } : {}),
    overrideAccess: true,
  });
  const byLine = new Map<string, number>();
  for (const m of docs) if (m.lineId) byLine.set(m.lineId, (byLine.get(m.lineId) ?? 0) + (m.unitQty ?? 0));
  return byLine;
}

/** What each line of a handed-over order can still take back (sold minus returned); for the order page. */
export async function returnableLines(payload: Payload, order: Order) {
  const back = await returnedOf(payload, order);
  return (order.lines ?? []).map((l) => ({ id: l.id ?? '', name: l.name, detail: l.detail, sold: l.unitQty, left: l.unitQty - (back.get(l.id ?? '') ?? 0) }));
}

export function returnItems(payload: Payload, orderId: string, input: { lines: { id: string; qty: number }[]; reason: string; user?: string }) {
  return withTx(payload, async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (order.status !== 'completed' && order.status !== 'refunded') throw new AppError('CONFLICT', 'transition', 'status');
    const wanted = input.lines.filter((l) => l.qty > 0);
    if (wanted.length === 0) throw new AppError('VALIDATION', 'nothingReturned', 'lines');
    const back = await returnedOf(tx.req.payload, order, tx);
    const lines = wanted.map((w) => {
      const line = (order.lines ?? []).find((l) => l.id === w.id);
      if (!line || !Number.isInteger(w.qty) || w.qty > line.unitQty - (back.get(w.id) ?? 0)) throw new AppError('VALIDATION', 'tooManyReturned', 'lines');
      return { line, qty: w.qty };
    });
    await postMovements(
      tx,
      lines.map(({ line, qty }) => ({
        variant: idOf(line.variant),
        unit: line.unit ? idOf(line.unit) : undefined,
        unitQty: qty,
        type: 'return' as const,
        reason: input.reason,
        channel: order.channel ?? 'webshop',
        ref: { relationTo: 'orders' as const, value: order.id },
        lineId: line.id ?? undefined,
        user: input.user,
      })),
    );
    // Rewriting the order makes two returns at once conflict: the later one is retried and re-counts.
    const note = lines.map(({ line, qty }) => `${qty} × ${line.name}`).join(', ');
    return setOrder(tx, order.id, { history: [...(order.history ?? []), historyRow('returned', input.user, `${note} — ${input.reason}`)] });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Reading

export async function getOrder(payload: Payload, id: string) {
  return payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, disableErrors: true });
}

export async function getReservation(payload: Payload, id: string): Promise<Reservation | null> {
  return payload.findByID({ collection: 'reservations', id, depth: 0, overrideAccess: true, disableErrors: true });
}

/**
 * Gives a guest order or table reservation (and its pre-order) to the account just created from it (GG-010). Only
 * a document without an account and with the same e-mail; the caller has checked the confirmation link.
 */
export async function attachToCustomer(payload: Payload, id: string, customer: { id: string; email: string }) {
  const order = await getOrder(payload, id);
  const reservation = order ? null : await getReservation(payload, id);
  const doc = order ?? reservation;
  if (!doc || doc.customer || doc.contact?.email?.toLowerCase() !== customer.email.toLowerCase()) throw new AppError('FORBIDDEN', 'attach');
  const ids = { orders: [order?.id, reservation?.preorder ? String(reservation.preorder) : null].filter(Boolean) as string[], reservations: reservation ? [reservation.id] : [] };
  for (const collection of ['orders', 'reservations'] as const) {
    for (const docId of ids[collection]) await payload.update({ collection, id: docId, data: { customer: customer.id }, overrideAccess: true, depth: 0 });
  }
  return { address: order?.mode === 'delivery' ? order.address : null };
}

/** A customer's own orders and reservations, read with their access (never anyone else's). */
export async function historyOf(payload: Payload, customer: Customer) {
  const user = { ...customer, collection: 'customers' as const };
  const [orders, reservations] = await Promise.all([
    payload.find({ collection: 'orders', where: { mode: { not_equals: 'table' } }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: false, user }),
    payload.find({ collection: 'reservations', sort: '-createdAt', limit: 50, depth: 0, overrideAccess: false, user }),
  ]);
  return { orders: orders.docs, reservations: reservations.docs };
}
