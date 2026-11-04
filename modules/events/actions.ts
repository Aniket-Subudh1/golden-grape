'use server';

import { after } from 'next/server';
import type { Payload } from 'payload';
import { z } from 'zod';
import { action, clientIp, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { currentCustomer } from '@/modules/customers/service';
import type { EventBooking } from '@/payload-types';
import { mailEventBooking } from './mail';
import { bookEvent as book, setBookingStatus } from './service';

const logMail = (error: unknown) => console.error('[mail] event booking', error);

async function sendBookingMail(payload: Payload, booking: EventBooking, staff: boolean) {
  const id = typeof booking.event === 'object' && booking.event ? booking.event.id : String(booking.event);
  const [fr, customer] = await Promise.all([
    payload.findByID({ collection: 'events', id, locale: 'fr', depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'events', id, locale: booking.locale ?? 'fr', depth: 0, overrideAccess: true }),
  ]);
  await mailEventBooking(booking, { fr, customer }, { staff });
}

const schema = z.object({
  idempotencyKey: z.uuid(),
  event: z.string().min(1),
  guests: z.coerce.number('required').int('invalid').min(1, 'required').max(20, 'invalid'),
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  email: z.email('email'),
  phone: z.string().trim().min(5, 'required').max(40, 'tooLong'),
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
  z.object({ booking: z.string().min(1), to: z.enum(['confirmed', 'cancelled']) }),
  { roles: ['sales'] },
  async ({ booking, to }, { payload }) => {
    const updated = await setBookingStatus(payload, booking, to);
    if (to === 'cancelled') after(() => sendBookingMail(payload, updated, false).catch(logMail));
    return { status: updated.status };
  },
);
