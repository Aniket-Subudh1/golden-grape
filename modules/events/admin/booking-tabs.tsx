import Link from 'next/link';
import type { Payload, Where } from 'payload';
import { l, type Label, valuesOf } from '@/lib/admin';
import { BOARD, bookingsHref } from './events-board';

// Above the bookings list (APPLUX report 4, §4): the event the list is filtered on, with a way back to the events,
// and the tabs Toutes / À confirmer / Confirmées with their counts. A tab is a plain Payload list query, so the
// search, columns and paging keep working.

const TABS: { status?: 'pending' | 'confirmed'; label: Label }[] = [
  { label: l('Toutes', 'All', 'Alle', 'Todas') },
  { status: 'pending', label: l('À confirmer', 'To confirm', 'Zu bestätigen', 'Por confirmar') },
  { status: 'confirmed', label: l('Confirmées', 'Confirmed', 'Bestätigt', 'Confirmadas') },
];

type Props = { payload: Payload; searchParams?: Record<string, unknown>; i18n?: { language: string } };

export default async function BookingTabs({ payload, searchParams = {}, i18n }: Props) {
  const lang = (i18n?.language ?? 'fr') as keyof Label;
  const say = (label: Label) => label[lang] ?? label.fr;
  const eventId = valuesOf(searchParams, /^where\[.*\]\[event\]\[equals\]$/)[0];
  const status = valuesOf(searchParams, /^where\[.*\]\[status\]\[equals\]$/)[0];
  const event = eventId && /^[a-f0-9]{24}$/.test(eventId) ? await payload.findByID({ collection: 'events', id: eventId, depth: 0, locale: lang, overrideAccess: true, disableErrors: true, select: { title: true } }) : null;
  const base: Where[] = event ? [{ event: { equals: event.id } }] : [];
  const counts = await Promise.all(TABS.map((t) => payload.count({ collection: 'eventBookings', where: { and: [...base, ...(t.status ? [{ status: { equals: t.status } }] : [])] }, overrideAccess: true }).then((r) => r.totalDocs)));
  const href = (s?: 'pending' | 'confirmed') => (event ? bookingsHref(event.id, s) : `/admin/collections/eventBookings${s ? `?where[and][0][status][equals]=${s}` : ''}`);

  return (
    <>
      <p className="gg-crumb">
        <Link href={BOARD}>← {say(l('Tous les événements', 'All events', 'Alle Veranstaltungen', 'Todos os eventos'))}</Link>
        {event && <b>{event.title}</b>}
      </p>
      <nav className="gg-tabs" aria-label={say(l('Réservations', 'Bookings', 'Buchungen', 'Reservas'))}>
        {TABS.map((t, i) => (
          <Link key={t.status ?? 'all'} href={href(t.status)} className="gg-tabs__tab" data-active={(status ?? undefined) === t.status || undefined} data-urgent={(t.status === 'pending' && counts[i] > 0) || undefined}>
            {say(t.label)}
            <span className="gg-tabs__count">{counts[i]}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
