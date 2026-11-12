import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { langOf } from '@/modules/sales/admin/text';

// Event reservations by event (APPLUX report 4, §4; `admin.components.views.eventBookings`, /admin/event-bookings):
// "À venir" and "Archives", one card per event in date order with its seats (reserved, remaining, to confirm) and
// the money received, and a button to that event's bookings. An event moves to the archives by itself once it is over.

export const BOARD = '/admin/event-bookings';

/** The bookings list of one event, optionally on one status (the list's tabs, booking-tabs.tsx). */
export const bookingsHref = (event: string, status?: 'pending' | 'confirmed') =>
  `/admin/collections/eventBookings?where[and][0][event][equals]=${event}${status ? `&where[and][1][status][equals]=${status}` : ''}`;

const TEXT = {
  fr: { title: 'Réservations d’événements', subtitle: 'Un événement par carte : les places, ce qui reste à confirmer et les paiements reçus.', upcoming: 'À venir', archives: 'Archives', reserved: 'Places réservées', remaining: 'Places restantes', unlimited: 'Illimité', toConfirm: 'À confirmer', received: 'Encaissé', free: 'Gratuit', of: 'sur', view: 'Voir les réservations', confirmNow: (n: number) => `${n} à confirmer`, none: 'Aucune réservation', bookings: (n: number) => `${n} réservation${n > 1 ? 's' : ''}`, draft: 'Brouillon', emptyUpcoming: 'Aucun événement à venir.', emptyArchives: 'Aucun événement passé.', forbidden: 'Votre rôle ne permet pas de voir les réservations.' },
  en: { title: 'Event bookings', subtitle: 'One card per event: the seats, what is still to confirm and the payments received.', upcoming: 'Upcoming', archives: 'Archives', reserved: 'Seats booked', remaining: 'Seats left', unlimited: 'Unlimited', toConfirm: 'To confirm', received: 'Received', free: 'Free', of: 'of', view: 'View bookings', confirmNow: (n: number) => `${n} to confirm`, none: 'No bookings', bookings: (n: number) => `${n} booking${n > 1 ? 's' : ''}`, draft: 'Draft', emptyUpcoming: 'No upcoming events.', emptyArchives: 'No past events.', forbidden: 'Your role cannot see bookings.' },
  de: { title: 'Veranstaltungsbuchungen', subtitle: 'Eine Karte pro Veranstaltung: Plätze, offene Bestätigungen und erhaltene Zahlungen.', upcoming: 'Bevorstehend', archives: 'Archiv', reserved: 'Gebuchte Plätze', remaining: 'Freie Plätze', unlimited: 'Unbegrenzt', toConfirm: 'Zu bestätigen', received: 'Erhalten', free: 'Kostenlos', of: 'von', view: 'Buchungen ansehen', confirmNow: (n: number) => `${n} zu bestätigen`, none: 'Keine Buchungen', bookings: (n: number) => `${n} Buchung${n > 1 ? 'en' : ''}`, draft: 'Entwurf', emptyUpcoming: 'Keine bevorstehenden Veranstaltungen.', emptyArchives: 'Keine vergangenen Veranstaltungen.', forbidden: 'Ihre Rolle darf Buchungen nicht sehen.' },
  pt: { title: 'Reservas de eventos', subtitle: 'Um cartão por evento: os lugares, o que falta confirmar e os pagamentos recebidos.', upcoming: 'Próximos', archives: 'Arquivo', reserved: 'Lugares reservados', remaining: 'Lugares livres', unlimited: 'Ilimitado', toConfirm: 'Por confirmar', received: 'Recebido', free: 'Grátis', of: 'de', view: 'Ver as reservas', confirmNow: (n: number) => `${n} por confirmar`, none: 'Sem reservas', bookings: (n: number) => `${n} reserva${n > 1 ? 's' : ''}`, draft: 'Rascunho', emptyUpcoming: 'Sem eventos próximos.', emptyArchives: 'Sem eventos passados.', forbidden: 'A sua função não permite ver as reservas.' },
};

export default async function EventsBoard({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect(`/admin/login?redirect=${encodeURIComponent(BOARD)}`);
  const lang = langOf(req.i18n.language);
  const t = TEXT[lang];
  const archives = searchParams?.tab === 'archives';
  const allowed = hasRole(req.user, ['sales']);
  const now = new Date().getTime();

  const [events, bookings] = allowed
    ? await Promise.all([
        // The published documents: `booked` is counted there by the booking service, never on a draft copy.
        req.payload.find({ collection: 'events', limit: 0, depth: 0, locale: lang, overrideAccess: true, select: { title: true, startsAt: true, endsAt: true, capacity: true, booked: true, priceCents: true, _status: true } }),
        req.payload.find({ collection: 'eventBookings', where: { status: { not_equals: 'cancelled' } }, limit: 0, depth: 0, overrideAccess: true, select: { event: true, guests: true, status: true, amountCents: true, paidCents: true, refundedCents: true } }),
      ])
    : [null, null];

  // Per event: bookings, guests still to confirm, money expected and received (cancelled bookings left out).
  const byEvent = new Map<string, { count: number; pending: number; pendingGuests: number; totalCents: number; paidCents: number }>();
  for (const b of bookings?.docs ?? []) {
    const key = String(typeof b.event === 'object' && b.event ? b.event.id : b.event);
    const sum = byEvent.get(key) ?? { count: 0, pending: 0, pendingGuests: 0, totalCents: 0, paidCents: 0 };
    sum.count++;
    if (b.status === 'pending') {
      sum.pending++;
      sum.pendingGuests += b.guests ?? 0;
    }
    sum.totalCents += b.amountCents ?? 0;
    sum.paidCents += (b.paidCents ?? 0) - (b.refundedCents ?? 0);
    byEvent.set(key, sum);
  }
  const over = (e: { startsAt: string; endsAt?: string | null }) => new Date(e.endsAt ?? e.startsAt).getTime() < now;
  const all = events?.docs ?? [];
  const upcoming = all.filter((e) => !over(e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter(over).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const shown = archives ? past : upcoming;
  const waiting = upcoming.reduce((n, e) => n + (byEvent.get(e.id)?.pending ?? 0), 0);

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user} visibleEntities={visibleEntities}>
      <Gutter>
        <div className="gg-home">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {!allowed ? (
            <p className="gg-card__empty">{t.forbidden}</p>
          ) : (
            <>
              <nav className="gg-tabs" aria-label={t.title}>
                <Link href={BOARD} className="gg-tabs__tab" data-active={!archives || undefined} data-urgent={waiting > 0 || undefined}>
                  {t.upcoming}
                  <span className="gg-tabs__count">{upcoming.length}</span>
                </Link>
                <Link href={`${BOARD}?tab=archives`} className="gg-tabs__tab" data-active={archives || undefined}>
                  {t.archives}
                  <span className="gg-tabs__count">{past.length}</span>
                </Link>
              </nav>
              {shown.length === 0 && <p className="gg-card__empty">{archives ? t.emptyArchives : t.emptyUpcoming}</p>}
              <div className="gg-events">
                {shown.map((e) => {
                  const sum = byEvent.get(e.id) ?? { count: 0, pending: 0, pendingGuests: 0, totalCents: 0, paidCents: 0 };
                  const when = eventDate(e.startsAt, e.endsAt, lang);
                  const booked = e.booked ?? 0;
                  const left = e.capacity ? Math.max(0, e.capacity - booked) : null;
                  return (
                    <article key={e.id} className="gg-event" data-waiting={sum.pending > 0 || undefined}>
                      <header>
                        <div>
                          <h2>{e.title}</h2>
                          <p>
                            {when.date} · {when.time}
                            {e._status === 'draft' && <span className="gg-badge gg-badge--neutral">{t.draft}</span>}
                          </p>
                        </div>
                        <span className="gg-event__count">{sum.count === 0 ? t.none : t.bookings(sum.count)}</span>
                      </header>
                      {e.capacity ? (
                        <div className="gg-event__bar" role="img" aria-label={`${booked} ${t.of} ${e.capacity}`}>
                          <span style={{ width: `${Math.min(100, (booked / e.capacity) * 100)}%` }} />
                        </div>
                      ) : null}
                      <dl>
                        <div>
                          <dt>{t.reserved}</dt>
                          <dd>
                            {booked}
                            {e.capacity ? <small> / {e.capacity}</small> : null}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.remaining}</dt>
                          <dd>{left === null ? t.unlimited : left}</dd>
                        </div>
                        <div data-tone={sum.pending > 0 ? 'due' : undefined}>
                          <dt>{t.toConfirm}</dt>
                          <dd>
                            {sum.pending}
                            {sum.pending > 0 && <small> · {sum.pendingGuests} pl.</small>}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.received}</dt>
                          <dd>
                            {e.priceCents > 0 ? (
                              <>
                                {formatMoney(sum.paidCents, lang)}
                                <small> / {formatMoney(sum.totalCents, lang)}</small>
                              </>
                            ) : (
                              t.free
                            )}
                          </dd>
                        </div>
                      </dl>
                      <footer>
                        <a className="gg-btn gg-btn--primary" href={bookingsHref(e.id)}>
                          {t.view}
                        </a>
                        {sum.pending > 0 && (
                          <a className="gg-btn gg-event__pending" href={bookingsHref(e.id, 'pending')}>
                            {t.confirmNow(sum.pending)}
                          </a>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
