'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { action, clientIp, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { parseDecimal } from '@/lib/money';
import { fromLocal, today } from '@/lib/time';
import { rateLimit } from '@/lib/rate-limit';
import { currentCustomer } from '@/modules/customers/service';
import { quoteCart } from '@/modules/promotions/service';
import { SLOT_MODES } from './collections';
import { mailOrderPlaced, mailOrderStatus, mailReservation } from './mail';
import { ORDER_STATUSES } from './order-states';
import { transitionReservation } from './reservations';
import { getOrder, getReservation, type MoneyResult, orderToken, placeOrder, recordPayment, recordRefund, requestRefund, slotCalendar, transition, zoneFor } from './service';
import { deliveryFee } from './zones';

// Checkout (public) and order / reservation decisions (staff). Error messages are dictionary keys (`form.fields.*`).

const lines = z.array(z.object({ variant: z.string().min(1).max(40), unit: z.string().min(1).max(40).optional(), qty: z.number().int().min(1).max(999) })).max(60);
const optionalText = (max: number) => z.string().trim().max(max, 'tooLong').optional().transform((v) => v || undefined);
const logMail = (what: string) => (error: unknown) => console.error(`[mail] ${what}`, error);

/** The bookable days and times of a mode, recounted on each call (the picker refreshes after a full slot). */
export const slotsFor = publicAction(z.object({ mode: z.enum(SLOT_MODES) }), async ({ mode }, { payload }) => slotCalendar(payload, mode));

/** Checkout totals with the delivery fee of the postcode typed (server prices and zones only). */
export const checkoutQuote = publicAction(
  z.object({ locale: z.enum(LOCALES), mode: z.enum(SLOT_MODES), lines, postalCode: z.string().max(12).optional() }),
  async (input, { payload }) => {
    const zone = input.mode === 'delivery' && input.postalCode?.trim() ? await zoneFor(payload, input.postalCode) : null;
    const quote = input.lines.length > 0 ? await quoteCart(payload, input.lines, { customer: await currentCustomer(), channel: 'webshop', locale: input.locale, delivery: zone }) : null;
    return {
      quote,
      zone: zone && {
        feeCents: zone.feeCents,
        minOrderCents: zone.minOrderCents,
        freeFromCents: zone.freeFromCents ?? null,
        belowMinimum: deliveryFee(zone, quote ? quote.subtotalCents - quote.discountCents : 0).belowMinimum,
      },
      outside: input.mode === 'delivery' && Boolean(input.postalCode?.trim()) && !zone,
    };
  },
);

const checkout = z
  .object({
    idempotencyKey: z.uuid(),
    mode: z.enum(SLOT_MODES),
    lines: z
      .string()
      .transform((text, ctx) => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'emptyCart' });
          return z.NEVER;
        }
      })
      .pipe(lines),
    date: z.iso.date('slotUnavailable'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'slotUnavailable'),
    name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    email: z.email('email'),
    phone: z.string().trim().min(5, 'required').max(40, 'tooLong'),
    line1: optionalText(200),
    line2: optionalText(200),
    postalCode: optionalText(12),
    city: optionalText(80),
    guests: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number('required').int('invalid').min(1, 'required').max(40, 'invalid').optional()),
    preorder: z.literal('on').optional(),
    payment: z.enum(['onsite', 'transfer'], 'required'),
    notes: optionalText(2000),
    locale: z.enum(LOCALES),
    website: z.string().optional(), // honeypot
  })
  .superRefine((d, ctx) => {
    if (d.mode !== 'delivery') return;
    for (const field of ['line1', 'postalCode', 'city'] as const) if (!d[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'required' });
  });

/** Places the order or table request; the e-mails go out after commit, only the first time a key is seen. */
export const placeOrderAction = publicAction(checkout, async ({ website, line1, line2, postalCode, city, preorder, ...input }, { payload }) => {
  if (website) return { kind: 'order' as const, id: '', number: '', token: '', created: false };
  await rateLimit(`order:${await clientIp()}`, 20, 10 * 60_000);
  const placed = await placeOrder(
    payload,
    { ...input, preorder: preorder === 'on', address: input.mode === 'delivery' ? { line1: line1!, line2, postalCode: postalCode!, city: city! } : undefined },
    { customer: await currentCustomer() },
  );
  if (placed.created) {
    after(async () => {
      if (placed.kind === 'order') {
        const order = await getOrder(payload, placed.id);
        if (order) await mailOrderPlaced(order).catch(logMail('order placed'));
      } else {
        const reservation = await getReservation(payload, placed.id);
        if (reservation) await mailReservation(payload, reservation, 'pending').catch(logMail('reservation placed'));
      }
    });
  }
  return { ...placed, token: orderToken(placed.id) };
});

/** Staff move an order along (admin buttons); the customer is told when the state machine says so. */
export const transitionOrder = action(
  z.object({ order: z.string().min(1), to: z.enum(ORDER_STATUSES), reason: optionalText(300) }),
  { roles: ['sales'] },
  async ({ order, to, reason }, { payload, user }) => {
    const result = await transition(payload, order, to, { user: user.id, reason });
    if (result.effects.includes('mailCustomer')) after(() => mailOrderStatus(result.order).catch(logMail('order status')));
    return { status: result.order.status };
  },
);

// Money staff record (GG-003/004). Amounts are typed in € ("12,50"), dates are the bank's day (not in the future).
const euros = z.string().transform((v, ctx) => {
  const cents = parseDecimal(v);
  if (!Number.isInteger(cents) || cents <= 0) ctx.addIssue({ code: 'custom', message: 'amount' });
  return cents;
});
const bankDay = z.iso.date('date').refine((d) => d <= today(), 'futureDate').transform((d) => {
  const [y, m, day] = d.split('-').map(Number);
  return fromLocal(y, m, day, 12);
});
const reasonText = z.string().trim().min(3, 'reasonRequired').max(300, 'tooLong');
const mailMoved = (result: MoneyResult) => {
  if (result.effects.includes('mailCustomer')) after(() => mailOrderStatus(result.order).catch(logMail('order status')));
};

/** Money received for an order: a transfer, a deposit or the rest. Paid in full → a waiting order is confirmed. */
export const recordOrderPayment = action(
  z.object({ order: z.string().min(1), amount: euros, at: bankDay, reference: optionalText(80) }),
  { roles: ['sales'] },
  async ({ order, amount, at, reference }, { payload, user }) => {
    const result = await recordPayment(payload, order, { amountCents: amount, at, reference, user: user.id });
    mailMoved(result);
    return { status: result.order.status };
  },
);

/** A refund decided (amount and reason); nothing is sent yet. */
export const requestOrderRefund = action(
  z.object({ order: z.string().min(1), amount: euros, reason: reasonText }),
  { roles: ['sales'] },
  async ({ order, amount, reason }, { payload, user }) => {
    const result = await requestRefund(payload, order, { amountCents: amount, reason, user: user.id });
    return { status: result.order.status };
  },
);

/** A refund actually sent; once everything is paid back, a handed-over order becomes "refunded" (customer e-mail). */
export const recordOrderRefund = action(
  z.object({ order: z.string().min(1), amount: euros, at: bankDay, method: z.enum(['transfer', 'onsite', 'card']), reference: optionalText(80), reason: reasonText }),
  { roles: ['sales'] },
  async ({ order, amount, at, method, reference, reason }, { payload, user }) => {
    const result = await recordRefund(payload, order, { amountCents: amount, at, method, reference, reason, user: user.id });
    mailMoved(result);
    return { status: result.order.status };
  },
);

/** Staff accept, decline, cancel or complete a table reservation; its pre-order follows in the same transaction. */
export const decideReservation = action(
  z.object({ reservation: z.string().min(1), to: z.enum(['accepted', 'rejected', 'cancelled', 'completed']) }),
  { roles: ['sales'] },
  async ({ reservation, to }, { payload, user }) => {
    const result = await transitionReservation(payload, reservation, to, { user: user.id });
    if (to !== 'completed') after(() => mailReservation(payload, result.reservation, to).catch(logMail('reservation status')));
    return { status: result.reservation.status };
  },
);
