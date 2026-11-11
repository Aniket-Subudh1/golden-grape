import type { UIFieldServerProps } from 'payload';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { recordBookingPaymentAction, setBookingStatusAction } from '../actions';
import { BOOKING_STATUS } from '../collections';

// An event booking's edit view (ui field `panel`): the seats, the guest, and confirm (paid on site) or cancel.

const TEXT = {
  fr: {
    event: 'Événement',
    guests: 'Personnes',
    amount: 'À régler sur place',
    free: 'Gratuit',
    customer: 'Client',
    language: 'Langue du client',
    message: 'Message du client',
    seats: (left: number | null) => (left === null ? 'Places illimitées' : `${left} place(s) encore libre(s)`),
    nothing: 'Plus rien à faire pour cette réservation.',
    confirmed: { label: 'Paiement reçu', hint: 'la réservation est confirmée.' },
    cancelled: { label: 'Annuler', hint: 'les places sont libérées et le client reçoit un e-mail.' },
    paid: 'Payé',
    payment: 'Paiement',
    received: 'Montant reçu (€)',
    paidOn: 'Reçu le',
    method: 'Moyen',
    reference: 'Référence (facultatif)',
    recordedBy: 'Enregistré par',
    methods: { onsite: 'Sur place', transfer: 'Virement', card: 'Carte' },
    paymentHint: 'la réservation est confirmée et le client reçoit un e-mail de confirmation du paiement.',
  },
  en: {
    event: 'Event',
    guests: 'Guests',
    amount: 'To pay on site',
    free: 'Free',
    customer: 'Customer',
    language: 'Customer’s language',
    message: 'Customer’s message',
    seats: (left: number | null) => (left === null ? 'Unlimited seats' : `${left} seat(s) still free`),
    nothing: 'Nothing left to do for this booking.',
    confirmed: { label: 'Payment received', hint: 'the booking is confirmed.' },
    cancelled: { label: 'Cancel', hint: 'the seats are freed and the customer gets an e-mail.' },
    paid: 'Paid',
    payment: 'Payment',
    received: 'Amount received (€)',
    paidOn: 'Received on',
    method: 'Method',
    reference: 'Reference (optional)',
    recordedBy: 'Recorded by',
    methods: { onsite: 'On site', transfer: 'Bank transfer', card: 'Card' },
    paymentHint: 'the booking is confirmed and the customer gets an e-mail confirming the payment.',
  },
  de: {
    event: 'Veranstaltung',
    guests: 'Personen',
    amount: 'Vor Ort zu bezahlen',
    free: 'Kostenlos',
    customer: 'Kunde',
    language: 'Sprache des Kunden',
    message: 'Nachricht des Kunden',
    seats: (left: number | null) => (left === null ? 'Unbegrenzte Plätze' : `${left} Platz/Plätze noch frei`),
    nothing: 'Für diese Buchung ist nichts mehr zu tun.',
    confirmed: { label: 'Zahlung erhalten', hint: 'die Buchung ist bestätigt.' },
    cancelled: { label: 'Stornieren', hint: 'die Plätze werden frei und der Kunde erhält eine E-Mail.' },
    paid: 'Bezahlt',
    payment: 'Zahlung',
    received: 'Erhaltener Betrag (€)',
    paidOn: 'Erhalten am',
    method: 'Art',
    reference: 'Referenz (optional)',
    recordedBy: 'Erfasst von',
    methods: { onsite: 'Vor Ort', transfer: 'Überweisung', card: 'Karte' },
    paymentHint: 'die Buchung ist bestätigt und der Kunde erhält eine E-Mail mit der Zahlungsbestätigung.',
  },
  pt: {
    event: 'Evento',
    guests: 'Pessoas',
    amount: 'A pagar no local',
    free: 'Grátis',
    customer: 'Cliente',
    language: 'Língua do cliente',
    message: 'Mensagem do cliente',
    seats: (left: number | null) => (left === null ? 'Lugares ilimitados' : `${left} lugar(es) ainda livre(s)`),
    nothing: 'Nada mais a fazer nesta reserva.',
    confirmed: { label: 'Pagamento recebido', hint: 'a reserva fica confirmada.' },
    cancelled: { label: 'Cancelar', hint: 'os lugares ficam livres e o cliente recebe um e-mail.' },
    paid: 'Pago',
    payment: 'Pagamento',
    received: 'Montante recebido (€)',
    paidOn: 'Recebido em',
    method: 'Meio',
    reference: 'Referência (opcional)',
    recordedBy: 'Registado por',
    methods: { onsite: 'No local', transfer: 'Transferência', card: 'Cartão' },
    paymentHint: 'a reserva fica confirmada e o cliente recebe um e-mail a confirmar o pagamento.',
  },
};

const TONES = { pending: 'warning', confirmed: 'success', cancelled: 'danger' } as const;
const DECIDE = {
  fr: { confirm: 'Confirmer', back: 'Retour', reason: 'Raison (facultatif, gardée dans l’historique)', reasonPh: 'Client malade, erreur de date…', done: 'Enregistré.', error: 'Impossible d’enregistrer. Réessayez.', errors: { transition: 'Quelqu’un vient de la modifier : la page se rafraîchit.' } },
  en: { confirm: 'Confirm', back: 'Back', reason: 'Reason (optional, kept in the history)', reasonPh: 'Customer ill, wrong date…', done: 'Saved.', error: 'Could not save. Please try again.', errors: { transition: 'Someone just changed it: the page refreshes.' } },
  de: { confirm: 'Bestätigen', back: 'Zurück', reason: 'Grund (optional, im Verlauf gespeichert)', reasonPh: 'Kunde krank, falsches Datum…', done: 'Gespeichert.', error: 'Speichern nicht möglich.', errors: { transition: 'Jemand hat sie gerade geändert: die Seite wird neu geladen.' } },
  pt: { confirm: 'Confirmar', back: 'Voltar', reason: 'Motivo (opcional, guardado no histórico)', reasonPh: 'Cliente doente, data errada…', done: 'Guardado.', error: 'Não foi possível guardar.', errors: { transition: 'Alguém acabou de a alterar: a página vai atualizar.' } },
};

export default async function BookingPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const lang = (i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT;
  const t = TEXT[lang];
  const booking = await payload.findByID({ collection: 'eventBookings', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!booking) return null;
  const event = await payload.findByID({ collection: 'events', id: String(booking.event), depth: 0, locale: lang, overrideAccess: true, disableErrors: true });
  const status = booking.status ?? 'pending';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Luxembourg' }).format(new Date());
  const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  // A paid booking is confirmed by recording its payment (§8): amount, day, method, reference; a free one never waits.
  const payDecision: Decision = {
    to: 'payment',
    label: t.confirmed.label,
    hint: t.paymentHint,
    tone: 'primary',
    action: recordBookingPaymentAction,
    fields: [
      { name: 'amount', label: t.received, kind: 'money', value: euros(booking.amountCents ?? 0), required: true },
      { name: 'at', label: t.paidOn, kind: 'date', value: today, max: today, required: true },
      { name: 'method', label: t.method, kind: 'select', value: 'onsite', options: (['onsite', 'transfer', 'card'] as const).map((v) => ({ value: v, label: t.methods[v] })) },
      { name: 'reference', label: t.reference, kind: 'text' },
    ],
  };
  const decisions: Decision[] = hasRole(user, ['sales'])
    ? [
        ...(status === 'pending' ? [(booking.amountCents ?? 0) > 0 ? payDecision : { to: 'confirmed', ...t.confirmed, tone: 'primary' as const }] : []),
        // GG-046: an optional reason, kept in the activity log.
        ...(status !== 'cancelled' ? [{ to: 'cancelled', ...t.cancelled, tone: 'danger' as const, reason: true }] : []),
      ]
    : [];
  const when = event ? eventDate(event.startsAt, event.endsAt, lang) : null;
  const payer = booking.payment?.user;
  const recordedBy = payer
    ? ((await payload.findByID({ collection: 'users', id: String(typeof payer === 'object' ? payer.id : payer), depth: 0, overrideAccess: true, disableErrors: true, select: { name: true } }))?.name ?? null)
    : null;
  const left = event?.capacity ? Math.max(0, event.capacity - (event.booked ?? 0)) : null;

  return (
    <DocPanel>
      <DocHead
        badge={<span className={`gg-badge gg-badge--${TONES[status]}`}>{BOOKING_STATUS[status][lang]}</span>}
        title={`${event?.title ?? '—'} · ${booking.guests} ${t.guests.toLowerCase()}`}
        sub={when ? `${when.date} · ${when.time}` : undefined}
      >
        {decisions.length > 0 ? (
          <DecisionBar action={setBookingStatusAction} target={{ booking: booking.id }} decisions={decisions} text={DECIDE[lang]} />
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
              [booking.payment?.amountCents ? t.paid : t.amount, booking.amountCents ? <b key="amount">{formatMoney(booking.amountCents, lang)}</b> : t.free],
              ['', t.seats(left)],
            ]}
          />
        </DocCard>
        {booking.payment?.amountCents ? (
          <DocCard title={t.payment}>
            <DocFacts
              rows={[
                [t.received.replace(' (€)', ''), <b key="paid">{formatMoney(booking.payment.amountCents, lang)}</b>],
                [t.paidOn, booking.payment.at ? new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(booking.payment.at)) : '—'],
                [t.method, booking.payment.method ? t.methods[booking.payment.method as keyof typeof t.methods] ?? booking.payment.method : '—'],
                [t.reference.replace(/ \(.*\)$/, ''), booking.payment.reference || '—'],
                [t.recordedBy, recordedBy ?? '—'],
              ]}
            />
          </DocCard>
        ) : null}
        {booking.notes && (
          <DocCard title={t.message} wide>
            <p className="gg-doc__note">{booking.notes}</p>
          </DocCard>
        )}
      </DocGrid>
    </DocPanel>
  );
}
