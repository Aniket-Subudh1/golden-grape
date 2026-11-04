import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';
import type { Payload, PayloadRequest } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { atRequest, getPayloadClient } from '@/lib/payload';
import { withTx } from '@/lib/tx';

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
          event: event.id,
          idempotencyKey: input.idempotencyKey,
          customer: customer?.id,
          contact: { name: input.name, email: input.email.toLowerCase(), phone: input.phone },
          guests: input.guests,
          amountCents: event.priceCents * input.guests,
          status: event.priceCents > 0 ? 'pending' : 'confirmed',
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

/** Staff confirm (paid on site) or cancel a booking; cancelling gives the seats back. */
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

/** Seats left for each event (null = unlimited), read live: the event pages are cached, the counter is not. */
export async function seatsLeft(eventIds: string[]): Promise<Record<string, number | null>> {
  await connection(); // request-time only: never part of a prerendered page
  if (eventIds.length === 0) return {};
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'events', where: { id: { in: eventIds } }, limit: 0, depth: 0, select: { capacity: true, booked: true }, overrideAccess: true });
  return Object.fromEntries(docs.map((e) => [e.id, e.capacity ? Math.max(0, e.capacity - (e.booked ?? 0)) : null]));
}
