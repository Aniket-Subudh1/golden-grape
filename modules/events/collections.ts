import type { CollectionConfig, Field } from 'payload';
import { hiddenUnless, isStaff, none, published, staffOrSelf } from '@/lib/access';
import { autoSlug, addButton, badgeCell, emptyList, l, listOnly, scaledNumber, seoSection } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { revalidateTagHook } from '@/lib/revalidate';
import { PAYMENT_METHOD_LABELS } from '@/modules/sales/collections';

const editors = isStaff('manager');

export const events: CollectionConfig = {
  slug: 'events',
  labels: {
    singular: l('Événement', 'Event', 'Veranstaltung', 'Evento'),
    plural: l('Événements', 'Events', 'Veranstaltungen', 'Eventos'),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'priceCents', '_status'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les soirées et dégustations affichées sur la page Événements et sur la page d’accueil.',
      'The evenings and tastings shown on the Events page and on the home page.',
      'Abende und Verkostungen auf der Veranstaltungsseite und der Startseite.',
      'As noites e provas mostradas na página Eventos e na página inicial.',
    ),
    components: addButton('events', l('Ajouter un événement', 'Add an event', 'Veranstaltung hinzufügen', 'Adicionar um evento')),
    preview: (doc, { locale }) => (doc.slug ? `/${locale}/events/${doc.slug}` : null),
  },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('events')], afterDelete: [revalidateTagHook('events')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: l('Nom de l’événement', 'Name of the event', 'Name der Veranstaltung', 'Nome do evento') },
    autoSlug('events'),
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          index: true,
          label: l('Début', 'Starts', 'Beginn', 'Início'),
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
        {
          name: 'endsAt',
          type: 'date',
          label: l('Fin (facultatif)', 'Ends (optional)', 'Ende (optional)', 'Fim (opcional)'),
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      label: l('Description', 'Description', 'Beschreibung', 'Descrição'),
      admin: {
        // Light Markdown is rendered on the event page and stripped from previews (QA 12 Nov, GG-14).
        description: l(
          'Le début sert d’aperçu sur la carte. Mise en forme possible : ## Titre, **gras**, *italique*, - liste.',
          'The beginning is the card’s preview. Formatting: ## Heading, **bold**, *italics*, - list.',
          'Der Anfang dient als Vorschau auf der Karte. Formatierung: ## Überschrift, **fett**, *kursiv*, - Liste.',
          'O início serve de pré-visualização no cartão. Formatação: ## Título, **negrito**, *itálico*, - lista.',
        ),
      },
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: l('Photo', 'Photo', 'Foto', 'Foto') },
    {
      type: 'row',
      fields: [
        {
          name: 'priceCents',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
          label: l('Prix par personne', 'Price per person', 'Preis pro Person', 'Preço por pessoa'),
          admin: { width: '50%', description: l('0 = gratuit', '0 = free', '0 = kostenlos', '0 = grátis'), components: scaledNumber('€') },
        },
        {
          name: 'capacity',
          type: 'number',
          min: 1,
          label: l('Places (facultatif)', 'Seats (optional)', 'Plätze (optional)', 'Lugares (opcional)'),
          admin: { width: '50%' },
        },
      ],
    },
    // Seats taken, written only by the booking service with a conditional $inc (service.ts); never typed by staff.
    {
      name: 'booked',
      type: 'number',
      defaultValue: 0,
      label: l('Places réservées', 'Seats booked', 'Gebuchte Plätze', 'Lugares reservados'),
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
    seoSection([
      { name: 'title', type: 'text', localized: true, label: l('Titre dans Google', 'Title in Google', 'Titel bei Google', 'Título no Google') },
      { name: 'description', type: 'textarea', localized: true, label: l('Texte dans Google', 'Text in Google', 'Text bei Google', 'Texto no Google') },
    ]),
  ],
};

/**
 * A booking's payment, apart from its status (APPLUX report 4, §4): a booking can be confirmed while only part of
 * it is paid. Computed from its payment rows by `bookingPaymentStatus` (service.ts).
 */
export const BOOKING_PAYMENT_STATUS = {
  free: l('Gratuit', 'Free', 'Kostenlos', 'Grátis'),
  pending: l('Non payé', 'Unpaid', 'Unbezahlt', 'Não pago'),
  partial: l('Partiellement payé', 'Partially paid', 'Teilweise bezahlt', 'Parcialmente pago'),
  paid: l('Payé', 'Paid', 'Bezahlt', 'Pago'),
  partially_refunded: l('Partiellement remboursé', 'Partially refunded', 'Teilweise erstattet', 'Parcialmente reembolsado'),
  refunded: l('Remboursé', 'Refunded', 'Erstattet', 'Reembolsado'),
};
export type BookingPaymentStatus = keyof typeof BOOKING_PAYMENT_STATUS;
export const BOOKING_PAYMENT_TONES = { free: 'neutral', pending: 'warning', partial: 'warning', paid: 'success', partially_refunded: 'neutral', refunded: 'neutral' } as const;
export const BOOKING_STATUS_TONES = { pending: 'warning', confirmed: 'success', cancelled: 'danger' } as const;

export const BOOKING_STATUS = {
  pending: l('À confirmer', 'To confirm', 'Zu bestätigen', 'Por confirmar'),
  confirmed: l('Confirmée', 'Confirmed', 'Bestätigt', 'Confirmada'),
  cancelled: l('Annulée', 'Cancelled', 'Storniert', 'Cancelada'),
};

const BOOKINGS_EMPTY = emptyList({
      icon: 'bookings',
      title: l('Aucune réservation d’événement', 'No event bookings yet', 'Noch keine Buchungen', 'Ainda sem reservas de eventos'),
      text: l(
        'Quand un client réserve des places pour un événement, la réservation apparaît ici.',
        'When a customer books seats for an event, the booking appears here.',
        'Wenn ein Kunde Plätze für eine Veranstaltung bucht, erscheint die Buchung hier.',
        'Quando um cliente reserva lugares para um evento, a reserva aparece aqui.',
      ),
    });

// Written only by bookEvent and the staff booking actions (service.ts), so `events.booked` always matches.
export const eventBookings: CollectionConfig = {
  slug: 'eventBookings',
  labels: {
    singular: l('Réservation d’événement', 'Event booking', 'Veranstaltungsbuchung', 'Reserva de evento'),
    plural: l('Places réservées', 'Event bookings', 'Veranstaltungsbuchungen', 'Reservas de eventos'),
  },
  admin: {
    // APPLUX audit 10 Nov, §15: a readable title ("Noite de Fado · Hans Müller (2 places)") instead of the record id.
    useAsTitle: 'label',
    defaultColumns: ['label', 'guests', 'status', 'paymentStatus', 'paidCents', 'amountCents', 'createdAt'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['label', 'contact.name', 'contact.email', 'contact.phone'],
    description: l(
      'Les places réservées depuis la page Événements. Le statut de la réservation et son paiement se suivent séparément.',
      'Seats booked from the Events page. A booking’s status and its payment are followed separately.',
      'Auf der Veranstaltungsseite gebuchte Plätze. Status und Zahlung einer Buchung werden getrennt verfolgt.',
      'Lugares reservados na página Eventos. O estado da reserva e o seu pagamento são seguidos em separado.',
    ),
    // The event's name and tabs first (booking-tabs.tsx), then the first-use state.
    components: { beforeListTable: ['@/modules/events/admin/booking-tabs', ...BOOKINGS_EMPTY.beforeListTable] },
  },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'panel', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/modules/events/admin/booking-panel' } } },
    { name: 'trail', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/components/admin/audit-trail' } } },
    ...(
      [
        { name: 'label', type: 'text', label: l('Réservation', 'Booking', 'Buchung', 'Reserva') },
        { name: 'event', type: 'relationship', relationTo: 'events', required: true, index: true, label: l('Événement', 'Event', 'Veranstaltung', 'Evento') },
        { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: { disableListColumn: true, disableListFilter: true } },
        { name: 'customer', type: 'relationship', relationTo: 'customers', label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente') },
        {
          name: 'contact',
          type: 'group',
          label: l('Client', 'Customer', 'Kunde', 'Cliente'),
          admin: { components: { Cell: '@/modules/sales/admin/cells#ContactCell' } },
          fields: [
            { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome') },
            { name: 'email', type: 'email', required: true, label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail') },
            { name: 'phone', type: 'text', required: true, label: l('Téléphone', 'Phone', 'Telefon', 'Telefone') },
          ],
        },
        { name: 'guests', type: 'number', required: true, min: 1, label: l('Personnes', 'Guests', 'Personen', 'Pessoas') },
        { name: 'amountCents', type: 'number', defaultValue: 0, label: l('Total', 'Total', 'Summe', 'Total'), admin: { components: scaledNumber('€') } },
        // The money received and paid back, one row each time, as staff recorded it ("Paiement reçu", "Rembourser").
        // Refund rows are negative, as on orders (payments/balance.ts). Written only by the booking service.
        {
          name: 'payments',
          type: 'array',
          label: l('Paiements', 'Payments', 'Zahlungen', 'Pagamentos'),
          // Shown on the booking's page; never a list column or filter (QA 12 Nov, GG-18).
          admin: { disableListColumn: true, disableListFilter: true },
          fields: [
            { name: 'kind', type: 'select', required: true, options: ['charge', 'refund'] },
            // The labels are what the booking's history prints for each payment line (audit-trail.tsx).
            { name: 'amountCents', type: 'number', required: true, label: l('Montant', 'Amount', 'Betrag', 'Montante') },
            { name: 'at', type: 'date', label: l('Date', 'Date', 'Datum', 'Data') },
            { name: 'method', type: 'select', label: l('Moyen', 'Method', 'Art', 'Meio'), options: (Object.keys(PAYMENT_METHOD_LABELS) as (keyof typeof PAYMENT_METHOD_LABELS)[]).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })) },
            { name: 'reference', type: 'text', label: l('Référence', 'Reference', 'Referenz', 'Referência') },
            { name: 'reason', type: 'text' },
            { name: 'user', type: 'relationship', relationTo: 'users' },
            { name: 'notedAt', type: 'date' },
          ],
        },
        // Kept equal to the sums of the rows above, so lists and the events board read them without loading the rows.
        { name: 'paidCents', type: 'number', defaultValue: 0, label: l('Reçu', 'Received', 'Erhalten', 'Recebido'), admin: { components: scaledNumber('€') } },
        { name: 'refundedCents', type: 'number', defaultValue: 0, label: l('Remboursé', 'Refunded', 'Erstattet', 'Reembolsado'), admin: { components: scaledNumber('€') } },
        {
          name: 'paymentStatus',
          type: 'select',
          index: true,
          label: l('Paiement', 'Payment', 'Zahlung', 'Pagamento'),
          options: (Object.keys(BOOKING_PAYMENT_STATUS) as BookingPaymentStatus[]).map((value) => ({ value, label: BOOKING_PAYMENT_STATUS[value] })),
          admin: { components: badgeCell(BOOKING_PAYMENT_TONES) },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          index: true,
          label: l('Statut', 'Status', 'Status', 'Estado'),
          options: (Object.keys(BOOKING_STATUS) as (keyof typeof BOOKING_STATUS)[]).map((value) => ({ value, label: BOOKING_STATUS[value] })),
          admin: { components: badgeCell(BOOKING_STATUS_TONES) },
        },
        { name: 'notes', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente') },
        {
          name: 'locale',
          type: 'select',
          required: true,
          defaultValue: 'fr',
          label: l('Langue du client', 'Customer’s language', 'Sprache des Kunden', 'Língua do cliente'),
          options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
        },
      ] as Field[]
    ).map(listOnly),
  ],
};
