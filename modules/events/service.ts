import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';
import type { Payload, PayloadRequest } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { atRequest, getPayloadClient } from '@/lib/payload';
import { withTx } from '@/lib/tx';
import { dueOf, paymentState, refundableOf } from '@/modules/payments/balance';
import type { BookingPaymentStatus } from './collections';

/** Published events that have not started yet, soonest first. Refreshed hourly and on every edit. */
async function upcomingCached(locale: Locale, limit = 24) {
  'use cache';
  cacheTag('events');
  cacheLife('hours');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'events',
    locale,
    where: { _status: { equals: 'published' }, startsAt: { greater_than_equal: new Date().toISOString() } },
    sort: 'startsAt',
    limit,
    depth: 1,
  });
  return docs;
}

async function eventCached(slug: string, locale: Locale) {
  'use cache';
  cacheTag('events');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'events',
    locale,
    where: { slug: { equals: slug }, _status: { equals: 'published' } },
    limit: 1,
    depth: 1,
  });
  return docs[0] ?? null;
}

export const upcomingEvents = atRequest(upcomingCached);
export const getEvent = atRequest(eventCached);

/** Every published event's slug and last change, for the sitemap. */
export async function publishedEventSlugs() {
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'events', where: { _status: { equals: 'published' } }, limit: 0, depth: 0, select: { slug: true, updatedAt: true } });
  return docs;
}

// ---------------------------------------------------------------------------------------------------------------
// Bookings (M2.3 T6)

export type BookEventInput = { idempotencyKey: string; event: string; guests: number; name: string; email: string; phone: string; notes?: string; locale: Locale };

/**
 * Books seats without overbooking (04 §4): one conditional `$inc` on `events.booked` that only matches while
 * `booked + guests ≤ capacity`, in the transaction that inserts the booking. Free events are confirmed at once;
 * paid ones wait as `pending` (paid on site in Phase 1). A repeated key returns the first booking.
 */
/** What staff call a booking (APPLUX audit 10 Nov, §15): "Noite de Fado · Hans Müller (2 places)", in French. */
export const bookingLabel = (eventTitle: string, name: string, guests: number) => `${eventTitle} · ${name} (${guests} ${guests > 1 ? 'places' : 'place'})`;

export async function bookEvent(payload: Payload, input: BookEventInput, { customer, now = new Date() }: { customer?: { id: string } | null; now?: Date } = {}) {
  const find = async (req?: PayloadRequest) =>
    (await payload.find({ collection: 'eventBookings', where: { idempotencyKey: { equals: input.idempotencyKey } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0];
  const existing = await find();
  if (existing) return { booking: existing, created: false };
  try {
    return await withTx(payload, async (tx) => {
      const again = await find(tx.req);
      if (again) return { booking: again, created: false };
      const event = await payload.findByID({ collection: 'events', id: input.event, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
      if (!event || event._status !== 'published' || new Date(event.startsAt) < now) throw new AppError('NOT_FOUND', 'event', 'event');
      const seat = event.capacity
        ? { _id: event.id, $expr: { $lte: [{ $add: [{ $ifNull: ['$booked', 0] }, input.guests] }, '$capacity'] } }
        : { _id: event.id };
      const taken = await tx.model('events').updateOne(seat, { $inc: { booked: input.guests } }, { session: tx.session });
      if (taken.matchedCount === 0) throw new AppError('CONFLICT', 'soldOut', 'guests');
      const booking = await payload.create({
        collection: 'eventBookings',
        req: tx.req,
        overrideAccess: true,
        depth: 0,
        data: {
          label: bookingLabel(event.title, input.name, input.guests),
          event: event.id,
          idempotencyKey: input.idempotencyKey,
          customer: customer?.id,
          contact: { name: input.name, email: input.email.toLowerCase(), phone: input.phone },
          guests: input.guests,
          amountCents: event.priceCents * input.guests,
          status: event.priceCents > 0 ? 'pending' : 'confirmed',
          paidCents: 0,
          refundedCents: 0,
          paymentStatus: event.priceCents > 0 ? 'pending' : 'free',
          notes: input.notes,
          locale: input.locale,
        },
      });
      return { booking, created: true };
    });
  } catch (error) {
    const placed = await find();
    if (placed) return { booking: placed, created: false };
    throw error;
  }
}

/** Staff confirm a booking (whatever its payment: the two are separate) or cancel it; cancelling gives the seats back. */
export async function setBookingStatus(payload: Payload, id: string, to: 'confirmed' | 'cancelled') {
  return withTx(payload, async (tx) => {
    const booking = await payload.findByID({ collection: 'eventBookings', id, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
    if (!booking) throw new AppError('NOT_FOUND', 'booking');
    const allowed = to === 'confirmed' ? booking.status === 'pending' : booking.status !== 'cancelled';
    if (!allowed) throw new AppError('CONFLICT', 'transition', 'status');
    const claim = await tx.model('eventBookings').updateOne({ _id: id, status: booking.status }, { $set: { status: to } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'transition', 'status');
    if (to === 'cancelled') {
      const eventId = typeof booking.event === 'object' && booking.event ? booking.event.id : booking.event;
      await tx.model('events').updateOne({ _id: eventId }, { $inc: { booked: -(booking.guests ?? 0) } }, { session: tx.session });
    }
    return payload.findByID({ collection: 'eventBookings', id, depth: 0, req: tx.req, overrideAccess: true });
  });
}

export type BookingPayment = { amountCents: number; at: Date; method: 'onsite' | 'transfer' | 'card'; reference?: string; reason?: string; user: string };

/** A booking's payment status from its figures: free events never owe anything (APPLUX report 4, §4). */
export const bookingPaymentStatus = (b: { amountCents?: number | null; paidCents?: number | null; refundedCents?: number | null }): BookingPaymentStatus =>
  (b.amountCents ?? 0) === 0 ? 'free' : (paymentState({ totalCents: b.amountCents ?? 0, paidCents: b.paidCents ?? 0, refundedCents: b.refundedCents ?? 0, refundDueCents: 0 }) as BookingPaymentStatus);

/**
 * One more payment row on a booking, in one transaction. The claim on the figure it changes (`paidCents` or
 * `refundedCents`, still at the value just read) makes two staff recording the same money at once count it once.
 */
async function addBookingPayment(payload: Payload, id: string, kind: 'charge' | 'refund', payment: BookingPayment) {
  return withTx(payload, async (tx) => {
    const booking = await payload.findByID({ collection: 'eventBookings', id, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
    if (!booking) throw new AppError('NOT_FOUND', 'booking');
    const money = { totalCents: booking.amountCents ?? 0, paidCents: booking.paidCents ?? 0, refundedCents: booking.refundedCents ?? 0, refundDueCents: 0 };
    if (kind === 'charge' && booking.status === 'cancelled') throw new AppError('CONFLICT', 'transition', 'status');
    const limit = kind === 'charge' ? dueOf(money) : refundableOf(money);
    if (payment.amountCents <= 0 || payment.amountCents > limit) throw new AppError('VALIDATION', 'amountTooHigh', 'amount');
    const field = kind === 'charge' ? 'paidCents' : 'refundedCents';
    const before = money[field];
    money[field] += payment.amountCents;
    const claim = await tx.model('eventBookings').updateOne({ _id: id, [field]: before === 0 ? { $in: [0, null] } : before }, { $set: { [field]: money[field] } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'transition', 'status');
    // Fully paid: a booking still waiting is confirmed. A part payment leaves its status to staff.
    const confirmed = kind === 'charge' && booking.status === 'pending' && dueOf(money) === 0;
    const updated = await payload.update({
      collection: 'eventBookings',
      id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: {
        payments: [
          ...(booking.payments ?? []),
          { kind, amountCents: kind === 'charge' ? payment.amountCents : -payment.amountCents, at: payment.at.toISOString(), method: payment.method, reference: payment.reference, reason: payment.reason, user: payment.user, notedAt: new Date().toISOString() },
        ],
        paymentStatus: bookingPaymentStatus({ amountCents: money.totalCents, ...money }),
        ...(confirmed ? { status: 'confirmed' as const } : {}),
      },
    });
    return { booking: updated, confirmed, dueCents: dueOf(money) };
  });
}

/**
 * "Payment received" on a paid booking: the money as staff recorded it (amount, the day it came in, how, the
 * reference, who). Several payments add up; never more than what is still due, never on a cancelled booking.
 */
export const recordBookingPayment = (payload: Payload, id: string, payment: BookingPayment) => addBookingPayment(payload, id, 'charge', payment);

/** Money given back on a booking: at most what was received and not yet refunded. The seats follow the status, not this. */
export const recordBookingRefund = (payload: Payload, id: string, payment: BookingPayment) => addBookingPayment(payload, id, 'refund', payment);

/** Seats left for each event (null = unlimited), read live: the event pages are cached, the counter is not. */
export async function seatsLeft(eventIds: string[]): Promise<Record<string, number | null>> {
  await connection(); // request-time only: never part of a prerendered page
  if (eventIds.length === 0) return {};
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'events', where: { id: { in: eventIds } }, limit: 0, depth: 0, select: { capacity: true, booked: true }, overrideAccess: true });
  return Object.fromEntries(docs.map((e) => [e.id, e.capacity ? Math.max(0, e.capacity - (e.booked ?? 0)) : null]));
}
