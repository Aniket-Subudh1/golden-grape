// One-off for APPLUX's audit of 10 Nov 2026; safe to run again. `--check` only reports.
// Event bookings made before 11 Nov get their readable title ("Noite de Fado · Hans Müller (2 places)", §15), which
// the admin, the bell and the history show instead of the record id.
// Run: npm run migrate:2026-11-11 -- --check
import { getPayload } from 'payload';
import { bookingLabel } from '@/modules/events/service';

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });

const { docs } = await payload.find({
  collection: 'eventBookings',
  where: { or: [{ label: { exists: false } }, { label: { equals: '' } }, { label: { equals: null } }] },
  limit: 0,
  depth: 0,
  overrideAccess: true,
});
const titles = new Map<string, string>();
for (const booking of docs) {
  const eventId = String(booking.event);
  if (!titles.has(eventId)) {
    const event = await payload.findByID({ collection: 'events', id: eventId, locale: 'fr', depth: 0, overrideAccess: true, disableErrors: true });
    titles.set(eventId, event?.title ?? '—');
  }
  const label = bookingLabel(titles.get(eventId)!, booking.contact?.name ?? '—', booking.guests ?? 1);
  console.info(`[eventBookings] ${booking.id} → ${label}`);
  if (!check) await payload.update({ collection: 'eventBookings', id: booking.id, data: { label }, depth: 0, overrideAccess: true, context: { skipRevalidate: true } });
}

console.info(`[migrate] ${docs.length} booking title(s)${check ? ' to set (check only)' : ' set'}`);
await payload.destroy();
process.exit(0);
