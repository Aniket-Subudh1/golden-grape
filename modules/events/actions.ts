'use server';

import { after } from 'next/server';
import type { Payload } from 'payload';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { action, bankDayField, clientIp, eurosField, phoneField, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { currentCustomer } from '@/modules/customers/service';
import type { EventBooking } from '@/payload-types';
import { mailEventBooking } from './mail';
import { bookEvent as book, recordBookingPayment, setBookingStatus } from './service';

const logMail = (error: unknown) => console.error('[mail] event booking', error);

async function sendBookingMail(payload: Payload, booking: EventBooking, staff: boolean, payment = false) {
  const id = typeof booking.event === 'object' && booking.event ? booking.event.id : String(booking.event);
  const [fr, customer] = await Promise.all([
    payload.findByID({ collection: 'events', id, locale: 'fr', depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'events', id, locale: booking.locale ?? 'fr', depth: 0, overrideAccess: true }),
  ]);
  await mailEventBooking(booking, { fr, customer }, { staff, payment });
}

const schema = z.object({
  idempotencyKey: z.uuid(),
  event: z.string().min(1),
  guests: z.coerce.number('required').int('invalid').min(1, 'required').max(20, 'invalid'),
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  email: z.email('email'),
  phone: phoneField,
  notes: z.string().trim().max(1000, 'tooLong').optional().transform((v) => v || undefined),
  locale: z.enum(LOCALES),
  website: z.string().optional(), // honeypot
});

/** Books seats (idempotent); the e-mails go out after commit, the first time only. */
export const bookEventAction = publicAction(schema, async ({ website, ...input }, { payload }) => {
  if (website) return { status: 'pending' as const, email: input.email };
  await rateLimit(`event:${await clientIp()}`, 10, 10 * 60_000);
  const { booking, created } = await book(payload, input, { customer: await currentCustomer() });
  if (created) after(() => sendBookingMail(payload, booking, true).catch(logMail));
  return { status: booking.status ?? 'pending', email: booking.contact?.email ?? input.email };
});

/** Staff confirm a booking paid on site, or cancel it (the seats go back). */
export const setBookingStatusAction = action(
  z.object({ booking: z.string().min(1), to: z.enum(['confirmed', 'cancelled']), reason: z.string().trim().max(300).optional() }),
  { roles: ['sales'] },
  async ({ booking, to, reason }, { payload, user }) => {
    const updated = await setBookingStatus(payload, booking, to);
    await audit(payload, { user: user.id, action: 'booking.status', collection: 'eventBookings', id: booking, ref: updated.label ?? updated.contact?.name, reason: reason || undefined, after: { status: to, guests: updated.guests } });
    if (to === 'cancelled') after(() => sendBookingMail(payload, updated, false).catch(logMail));
    return { status: updated.status };
  },
);

/**
 * "Payment received" on a paid booking (APPLUX audit 10 Nov, §7–§8): the payment and the confirmation are two lines
 * of the history (amount, day, method, reference, who; then pending → confirmed), and the customer gets a separate
 * e-mail confirming the payment and the booking.
 */
export const recordBookingPaymentAction = action(
  z.object({
    booking: z.string().min(1),
    amount: eurosField,
    at: bankDayField,
    method: z.enum(['onsite', 'transfer', 'card']),
    reference: z.string().trim().max(80, 'tooLong').optional().transform((v) => v || undefined),
  }),
  { roles: ['sales'] },
  async ({ booking, amount, at, method, reference }, { payload, user }) => {
    const updated = await recordBookingPayment(payload, booking, { amountCents: amount, at, method, reference, user: user.id });
    const ref = updated.label ?? updated.contact?.name;
    await audit(payload, { user: user.id, action: 'booking.payment', collection: 'eventBookings', id: booking, ref, after: { 'payment.amountCents': amount, 'payment.at': at.toISOString().slice(0, 10), 'payment.method': method, 'payment.reference': reference } });
    await audit(payload, { user: user.id, action: 'booking.status', collection: 'eventBookings', id: booking, ref, before: { status: 'pending' }, after: { status: 'confirmed' } });
    after(() => sendBookingMail(payload, updated, false, true).catch(logMail));
    return { status: updated.status };
  },
);
