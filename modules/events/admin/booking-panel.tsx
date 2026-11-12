import type { UIFieldServerProps } from 'payload';
import type { ReactNode } from 'react';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocBadge, DocCard, DocFacts, DocFigures, DocGrid, DocHead, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { eventDate, today } from '@/lib/time';
import { dueOf, refundableOf } from '@/modules/payments/balance';
import { langOf, salesText } from '@/modules/sales/admin/text';
import { recordBookingPaymentAction, recordBookingRefundAction, setBookingStatusAction } from '../actions';
import { BOOKING_PAYMENT_STATUS, BOOKING_PAYMENT_TONES, BOOKING_STATUS, BOOKING_STATUS_TONES } from '../collections';
import { bookingPaymentStatus } from '../service';
import { bookingsHref } from './events-board';

// An event booking's edit view (ui field `panel`). Its status (to confirm, confirmed, cancelled) and its payment
// (free, unpaid, partly paid, paid, refunded) are two separate things (APPLUX report 4, §4): the header shows both,
// with the total, what was received and what is still due, then the payments one by one.

const TEXT = {
  fr: {
    event: 'Événement',
    booking: 'Réservation',
    guests: 'Personnes',
    free: 'Gratuit',
    customer: 'Client',
    language: 'Langue du client',
    message: 'Message du client',
    seats: (left: number | null) => (left === null ? 'Places illimitées' : `${left} place(s) encore libre(s)`),
    nothing: 'Plus rien à faire pour cette réservation.',
    all: 'Toutes les réservations de cet événement',
    pay: { label: 'Paiement reçu', hint: 'notez l’argent réellement reçu (acompte ou solde). Le client reçoit un e-mail ; une fois le total reçu, une réservation à confirmer est confirmée.' },
    confirm: { label: 'Confirmer la réservation', hint: 'les places sont confirmées. Le paiement reste à part : il peut être enregistré avant ou après.' },
    confirmFree: { label: 'Confirmer la réservation', hint: 'la réservation est confirmée.' },
    refund: { label: 'Rembourser', hint: 'notez le remboursement réellement envoyé au client. Le statut de la réservation ne change pas : annulez-la à part si besoin.' },
    cancel: { label: 'Annuler la réservation', hint: 'les places sont libérées et le client reçoit un e-mail. Ce qu’il a payé reste à rembourser à part.' },
    next: {
      confirm: 'À confirmer : vérifiez la demande, puis confirmez la réservation ou enregistrez le paiement reçu.',
      due: (amount: string) => `Réservation confirmée, reste à encaisser : ${amount}.`,
      refund: (amount: string) => `Réservation annulée avec ${amount} encaissés : pensez à rembourser le client.`,
    },
    recordedOn: 'noté le',
  },
  en: {
    event: 'Event',
    booking: 'Booking',
    guests: 'Guests',
    free: 'Free',
    customer: 'Customer',
    language: 'Customer’s language',
    message: 'Customer’s message',
    seats: (left: number | null) => (left === null ? 'Unlimited seats' : `${left} seat(s) still free`),
    nothing: 'Nothing left to do for this booking.',
    all: 'All bookings for this event',
    pay: { label: 'Payment received', hint: 'record the money actually received (deposit or balance). The customer gets an e-mail; once the total is in, a booking still to confirm is confirmed.' },
    confirm: { label: 'Confirm the booking', hint: 'the seats are confirmed. The payment is separate: it can be recorded before or after.' },
    confirmFree: { label: 'Confirm the booking', hint: 'the booking is confirmed.' },
    refund: { label: 'Refund', hint: 'record the refund actually sent to the customer. The booking’s status does not change: cancel it separately if needed.' },
    cancel: { label: 'Cancel the booking', hint: 'the seats are freed and the customer gets an e-mail. What they paid is refunded separately.' },
    next: {
      confirm: 'To confirm: check the request, then confirm the booking or record the payment received.',
      due: (amount: string) => `Booking confirmed, still to collect: ${amount}.`,
      refund: (amount: string) => `Booking cancelled with ${amount} received: remember to refund the customer.`,
    },
    recordedOn: 'recorded on',
  },
  de: {
    event: 'Veranstaltung',
    booking: 'Buchung',
    guests: 'Personen',
    free: 'Kostenlos',
    customer: 'Kunde',
    language: 'Sprache des Kunden',
    message: 'Nachricht des Kunden',
    seats: (left: number | null) => (left === null ? 'Unbegrenzte Plätze' : `${left} Platz/Plätze noch frei`),
    nothing: 'Für diese Buchung ist nichts mehr zu tun.',
    all: 'Alle Buchungen dieser Veranstaltung',
    pay: { label: 'Zahlung erhalten', hint: 'erfassen Sie das tatsächlich erhaltene Geld (Anzahlung oder Rest). Der Kunde erhält eine E-Mail; ist alles bezahlt, wird eine offene Buchung bestätigt.' },
    confirm: { label: 'Buchung bestätigen', hint: 'die Plätze sind bestätigt. Die Zahlung ist getrennt: sie kann vorher oder nachher erfasst werden.' },
    confirmFree: { label: 'Buchung bestätigen', hint: 'die Buchung ist bestätigt.' },
    refund: { label: 'Erstatten', hint: 'erfassen Sie die tatsächlich gesendete Erstattung. Der Status der Buchung ändert sich nicht: bei Bedarf separat stornieren.' },
    cancel: { label: 'Buchung stornieren', hint: 'die Plätze werden frei und der Kunde erhält eine E-Mail. Bereits Bezahltes wird separat erstattet.' },
    next: {
      confirm: 'Zu bestätigen: Anfrage prüfen, dann die Buchung bestätigen oder die erhaltene Zahlung erfassen.',
      due: (amount: string) => `Buchung bestätigt, noch zu kassieren: ${amount}.`,
      refund: (amount: string) => `Buchung storniert, ${amount} erhalten: bitte dem Kunden erstatten.`,
    },
    recordedOn: 'erfasst am',
  },
  pt: {
    event: 'Evento',
    booking: 'Reserva',
    guests: 'Pessoas',
    free: 'Grátis',
    customer: 'Cliente',
    language: 'Língua do cliente',
    message: 'Mensagem do cliente',
    seats: (left: number | null) => (left === null ? 'Lugares ilimitados' : `${left} lugar(es) ainda livre(s)`),
    nothing: 'Nada mais a fazer nesta reserva.',
    all: 'Todas as reservas deste evento',
    pay: { label: 'Pagamento recebido', hint: 'registe o dinheiro realmente recebido (sinal ou saldo). O cliente recebe um e-mail; com o total recebido, uma reserva por confirmar fica confirmada.' },
    confirm: { label: 'Confirmar a reserva', hint: 'os lugares ficam confirmados. O pagamento é à parte: pode ser registado antes ou depois.' },
    confirmFree: { label: 'Confirmar a reserva', hint: 'a reserva fica confirmada.' },
    refund: { label: 'Reembolsar', hint: 'registe o reembolso realmente enviado ao cliente. O estado da reserva não muda: cancele-a à parte se for preciso.' },
    cancel: { label: 'Cancelar a reserva', hint: 'os lugares ficam livres e o cliente recebe um e-mail. O que pagou é reembolsado à parte.' },
    next: {
      confirm: 'Por confirmar: verifique o pedido e confirme a reserva ou registe o pagamento recebido.',
      due: (amount: string) => `Reserva confirmada, ainda por cobrar: ${amount}.`,
      refund: (amount: string) => `Reserva cancelada com ${amount} recebidos: não se esqueça de reembolsar o cliente.`,
    },
    recordedOn: 'registado em',
  },
};

const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export default async function BookingPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const lang = langOf(i18n.language);
  const t = TEXT[lang];
  // The money words and the decision bar's texts are the orders' (one wording for payments everywhere).
  const s = salesText(lang);
  const m = s.money;
  const booking = await payload.findByID({ collection: 'eventBookings', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!booking) return null;
  const [event, staff] = await Promise.all([
    payload.findByID({ collection: 'events', id: String(booking.event), depth: 0, locale: lang, overrideAccess: true, disableErrors: true }),
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true, select: { name: true } }),
  ]);
  const staffName = new Map(staff.docs.map((u) => [u.id, u.name]));
  const status = booking.status ?? 'pending';
  const money = (cents: number) => formatMoney(cents, lang);
  const f = { totalCents: booking.amountCents ?? 0, paidCents: booking.paidCents ?? 0, refundedCents: booking.refundedCents ?? 0, refundDueCents: 0 };
  const due = status === 'cancelled' ? 0 : dueOf(f);
  const refundable = refundableOf(f);
  const payStatus = bookingPaymentStatus(booking);
  const day = today();
  const paid = f.totalCents > 0;
  const methods = (['onsite', 'transfer', 'card'] as const).map((v) => ({ value: v, label: m.methods[v] }));
  const moneyFields = (amount: number, method: string) => [
    { name: 'amount', label: m.amount, kind: 'money' as const, value: euros(amount), required: true },
    { name: 'at', label: m.date, kind: 'date' as const, value: day, max: day, required: true },
    { name: 'method', label: m.method, kind: 'select' as const, value: method, options: methods },
    { name: 'reference', label: m.bankRef, kind: 'text' as const },
  ];
  // The main next step first, the ways back last.
  const decisions: Decision[] = hasRole(user, ['sales'])
    ? [
        ...(due > 0 ? [{ to: 'payment', ...t.pay, tone: 'primary' as const, action: recordBookingPaymentAction, fields: moneyFields(due, 'onsite') }] : []),
        ...(status === 'pending' ? [{ to: 'confirmed', ...(paid ? t.confirm : t.confirmFree), tone: due > 0 ? undefined : ('primary' as const) }] : []),
        ...(refundable > 0 ? [{ to: 'refund', ...t.refund, tone: 'danger' as const, action: recordBookingRefundAction, reason: 'required' as const, fields: moneyFields(refundable, 'transfer') }] : []),
        // GG-046: an optional reason, kept in the activity log.
        ...(status !== 'cancelled' ? [{ to: 'cancelled', ...t.cancel, tone: 'danger' as const, reason: true }] : []),
      ]
    : [];
  const when = event ? eventDate(event.startsAt, event.endsAt, lang) : null;
  const left = event?.capacity ? Math.max(0, event.capacity - (event.booked ?? 0)) : null;
  const next = status === 'pending' ? t.next.confirm : status === 'confirmed' && due > 0 ? t.next.due(money(due)) : status === 'cancelled' && refundable > 0 ? t.next.refund(money(refundable)) : null;
  const dayOf = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Europe/Luxembourg' });
  const noted = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });

  return (
    <DocPanel>
      <DocHead
        badge={
          <>
            <DocBadge label={t.booking} tone={BOOKING_STATUS_TONES[status]}>
              {BOOKING_STATUS[status][lang]}
            </DocBadge>
            <DocBadge label={s.payment} tone={BOOKING_PAYMENT_TONES[payStatus]}>
              {BOOKING_PAYMENT_STATUS[payStatus][lang]}
            </DocBadge>
          </>
        }
        title={`${event?.title ?? '—'} · ${booking.guests} ${t.guests.toLowerCase()}`}
        sub={[booking.contact?.name, when ? `${when.date} · ${when.time}` : null].filter(Boolean).join(' · ')}
        figures={
          paid && (
            <DocFigures
              items={[
                { label: s.toPay, value: money(f.totalCents) },
                { label: m.paid, value: money(f.paidCents), tone: f.paidCents > 0 ? 'ok' : undefined },
                { label: m.due, value: money(due), tone: due > 0 ? 'due' : undefined },
                ...(f.refundedCents ? [{ label: m.refunded, value: money(f.refundedCents) }] : []),
              ]}
            />
          )
        }
        next={
          next && (
            <>
              <strong>{s.nextStep}</strong>
              <span>{next}</span>
            </>
          )
        }
      >
        {decisions.length > 0 ? (
          <DecisionBar action={setBookingStatusAction} target={{ booking: booking.id }} decisions={decisions} text={s.decide} />
        ) : (
          <p className="gg-doc__muted">{t.nothing}</p>
        )}
      </DocHead>
      <DocGrid>
        <DocCard title={t.customer}>
          <DocFacts
            rows={[
              [t.customer, booking.contact?.name],
              ['E-mail', booking.contact?.email ? <a href={`mailto:${booking.contact.email}`}>{booking.contact.email}</a> : '—'],
              ['Tel.', booking.contact?.phone ? <a href={`tel:${booking.contact.phone.replace(/\s/g, '')}`}>{booking.contact.phone}</a> : '—'],
              [t.language, LOCALE_NAMES[(booking.locale ?? 'fr') as Locale]],
            ]}
          />
        </DocCard>
        <DocCard title={t.event}>
          <DocFacts
            rows={[
              [t.event, event ? <a href={`/admin/collections/events/${event.id}`}>{event.title}</a> : '—'],
              [t.guests, booking.guests],
              [s.toPay, paid ? <b key="amount">{money(f.totalCents)}</b> : t.free],
              ['', t.seats(left)],
              ...(event ? [[' ', <a key="all" href={bookingsHref(event.id)}>{t.all}</a>] as [string, ReactNode]] : []),
            ]}
          />
        </DocCard>
        {paid && (
          <DocCard title={m.payments} wide>
            {(booking.payments ?? []).length === 0 ? (
              <p className="gg-doc__muted">{m.noPayments}</p>
            ) : (
              <table className="gg-doc__lines">
                <tbody>
                  {(booking.payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        {m.kinds[p.kind] ?? p.kind}
                        <small>
                          {[
                            p.method ? (m.methods[p.method as keyof typeof m.methods] ?? p.method) : null,
                            p.reference,
                            p.reason ? `« ${p.reason} »` : null,
                            [p.user ? staffName.get(String(typeof p.user === 'object' ? p.user.id : p.user)) : null, p.notedAt ? `${t.recordedOn} ${noted.format(new Date(p.notedAt))}` : null].filter(Boolean).join(', '),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </td>
                      <td>{p.at ? dayOf.format(new Date(p.at)) : '—'}</td>
                      <td>{money(p.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DocCard>
        )}
        {booking.notes && (
          <DocCard title={t.message} wide>
            <p className="gg-doc__note">{booking.notes}</p>
          </DocCard>
        )}
      </DocGrid>
    </DocPanel>
  );
}
