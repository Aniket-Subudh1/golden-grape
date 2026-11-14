import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps, DefaultServerCellComponentProps } from 'payload';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { langOf } from '@/modules/sales/admin/text';

// Event reservations by event (APPLUX report 4, §4; `admin.components.views.eventBookings`, /admin/event-bookings):
// "À venir" and "Archives", one card per event in date order with its seats (reserved, remaining, to confirm) and
// the money received, and a button to that event's bookings. An event moves to the archives by itself once it is over.

export const BOARD = '/admin/event-bookings';

/** An event is over once its end, or its start when it has no end, has passed: the archives here, "Passé" in the Events list. */
export const eventOver = (e: { startsAt: string; endsAt?: string | null }, now = Date.now()) => new Date(e.endsAt ?? e.startsAt).getTime() < now;

/** The bookings list of one event, optionally on one status (the list's tabs, booking-tabs.tsx). */
export const bookingsHref = (event: string, status?: 'pending' | 'confirmed') =>
  `/admin/collections/eventBookings?where[and][0][event][equals]=${event}${status ? `&where[and][1][status][equals]=${status}` : ''}`;

const TEXT = {
  fr: { title: 'Réservations d’événements', subtitle: 'Un événement par carte : les places, ce qui reste à confirmer et les paiements reçus.', upcoming: 'À venir', archives: 'Archives', soon: 'À venir', ongoing: 'En cours', past: 'Passé', reserved: 'Places réservées', remaining: 'Places restantes', unlimited: 'Illimité', toConfirm: 'À confirmer', received: 'Encaissé', refund: 'À rembourser (annulées)', waiting: (n: number) => `${n} réservation${n > 1 ? 's' : ''} à confirmer :`, free: 'Gratuit', of: 'sur', view: 'Voir les réservations', confirmNow: (n: number) => `${n} à confirmer`, none: 'Aucune réservation', bookings: (n: number) => `${n} réservation${n > 1 ? 's' : ''}`, draft: 'Brouillon', emptyUpcoming: 'Aucun événement à venir.', emptyArchives: 'Aucun événement passé.', forbidden: 'Votre rôle ne permet pas de voir les réservations.' },
  en: { title: 'Event bookings', subtitle: 'One card per event: the seats, what is still to confirm and the payments received.', upcoming: 'Upcoming', archives: 'Archives', soon: 'Upcoming', ongoing: 'Ongoing', past: 'Past', reserved: 'Seats booked', remaining: 'Seats left', unlimited: 'Unlimited', toConfirm: 'To confirm', received: 'Received', refund: 'To refund (cancelled)', waiting: (n: number) => `${n} booking${n > 1 ? 's' : ''} to confirm:`, free: 'Free', of: 'of', view: 'View bookings', confirmNow: (n: number) => `${n} to confirm`, none: 'No bookings', bookings: (n: number) => `${n} booking${n > 1 ? 's' : ''}`, draft: 'Draft', emptyUpcoming: 'No upcoming events.', emptyArchives: 'No past events.', forbidden: 'Your role cannot see bookings.' },
  de: { title: 'Veranstaltungsbuchungen', subtitle: 'Eine Karte pro Veranstaltung: Plätze, offene Bestätigungen und erhaltene Zahlungen.', upcoming: 'Bevorstehend', archives: 'Archiv', soon: 'Bevorstehend', ongoing: 'Läuft', past: 'Vorbei', reserved: 'Gebuchte Plätze', remaining: 'Freie Plätze', unlimited: 'Unbegrenzt', toConfirm: 'Zu bestätigen', received: 'Erhalten', refund: 'Zu erstatten (storniert)', waiting: (n: number) => `${n} Buchung${n > 1 ? 'en' : ''} zu bestätigen:`, free: 'Kostenlos', of: 'von', view: 'Buchungen ansehen', confirmNow: (n: number) => `${n} zu bestätigen`, none: 'Keine Buchungen', bookings: (n: number) => `${n} Buchung${n > 1 ? 'en' : ''}`, draft: 'Entwurf', emptyUpcoming: 'Keine bevorstehenden Veranstaltungen.', emptyArchives: 'Keine vergangenen Veranstaltungen.', forbidden: 'Ihre Rolle darf Buchungen nicht sehen.' },
  pt: { title: 'Reservas de eventos', subtitle: 'Um cartão por evento: os lugares, o que falta confirmar e os pagamentos recebidos.', upcoming: 'Próximos', archives: 'Arquivo', soon: 'Próximo', ongoing: 'A decorrer', past: 'Passado', reserved: 'Lugares reservados', remaining: 'Lugares livres', unlimited: 'Ilimitado', toConfirm: 'Por confirmar', received: 'Recebido', refund: 'A reembolsar (canceladas)', waiting: (n: number) => `${n} reserva${n > 1 ? 's' : ''} por confirmar:`, free: 'Grátis', of: 'de', view: 'Ver as reservas', confirmNow: (n: number) => `${n} por confirmar`, none: 'Sem reservas', bookings: (n: number) => `${n} reserva${n > 1 ? 's' : ''}`, draft: 'Rascunho', emptyUpcoming: 'Sem eventos próximos.', emptyArchives: 'Sem eventos passados.', forbidden: 'A sua função não permite ver as reservas.' },
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
        // Every booking: a cancelled one still counts in the money while it holds some (a refund to send, GG-11).
        req.payload.find({ collection: 'eventBookings', limit: 0, depth: 0, overrideAccess: true, select: { event: true, guests: true, status: true, amountCents: true, paidCents: true, refundedCents: true } }),
      ])
    : [null, null];

  // Per event: bookings, guests still to confirm, money expected and received (less refunds) on the active bookings,
  // and apart, what cancelled bookings still hold: a refund to send, no longer lost from the figures (QA 12 Nov, GG-11).
  const EMPTY = { count: 0, pending: 0, pendingGuests: 0, totalCents: 0, paidCents: 0, refundCents: 0 };
  const byEvent = new Map<string, typeof EMPTY>();
  for (const b of bookings?.docs ?? []) {
    const key = String(typeof b.event === 'object' && b.event ? b.event.id : b.event);
    const sum = byEvent.get(key) ?? { ...EMPTY };
    const held = (b.paidCents ?? 0) - (b.refundedCents ?? 0);
    if (b.status === 'cancelled') sum.refundCents += Math.max(0, held);
    else {
      sum.count++;
      sum.totalCents += b.amountCents ?? 0;
      sum.paidCents += held;
      if (b.status === 'pending') {
        sum.pending++;
        sum.pendingGuests += b.guests ?? 0;
      }
    }
    byEvent.set(key, sum);
  }
  const all = events?.docs ?? [];
  const upcoming = all.filter((e) => !eventOver(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((e) => eventOver(e, now)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
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
              {/* What waits for a decision, first and actionable (GG-11): each event's bookings to confirm. */}
              {!archives && waiting > 0 && (
                <p className="gg-events__waiting">
                  <b>{t.waiting(waiting)}</b>
                  {upcoming
                    .filter((e) => (byEvent.get(e.id)?.pending ?? 0) > 0)
                    .map((e) => (
                      <a key={e.id} href={bookingsHref(e.id, 'pending')}>
                        {e.title} ({byEvent.get(e.id)!.pending})
                      </a>
                    ))}
                </p>
              )}
              <div className="gg-events">
                {shown.map((e) => {
                  const sum = byEvent.get(e.id) ?? EMPTY;
                  const when = eventDate(e.startsAt, e.endsAt, lang);
                  const booked = e.booked ?? 0;
                  const left = e.capacity ? Math.max(0, e.capacity - booked) : null;
                  return (
                    <article key={e.id} className="gg-event" data-waiting={sum.pending > 0 || undefined} data-past={archives || undefined}>
                      <header>
                        <div>
                          <h2>{e.title}</h2>
                          <p>
                            {when.date} · {when.time}
                            {/* An archived event says so at a glance (QA 14 Nov, GG-24). */}
                            {archives && <span className="gg-badge gg-badge--neutral">{t.past}</span>}
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
                        {sum.refundCents > 0 && (
                          <div data-tone="due">
                            <dt>{t.refund}</dt>
                            <dd>{formatMoney(sum.refundCents, lang)}</dd>
                          </div>
                        )}
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

/** "À venir", "En cours" or "Passé" in the Events list (QA 14 Nov, GG-24), by the same rule as the archives here. */
export async function EventTimingCell({ rowData, i18n }: DefaultServerCellComponentProps) {
  const e = rowData as { startsAt?: string; endsAt?: string | null };
  if (!e?.startsAt) return null;
  const t = TEXT[langOf(i18n.language)];
  const now = new Date().getTime();
  const [tone, label] = eventOver({ startsAt: e.startsAt, endsAt: e.endsAt }, now) ? ['neutral', t.past] : new Date(e.startsAt).getTime() <= now ? ['info', t.ongoing] : ['success', t.soon];
  return <span className={`gg-badge gg-badge--${tone}`}>{label}</span>;
}
