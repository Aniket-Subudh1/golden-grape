import { baseIDField, type CollectionConfig, type Field, type PayloadRequest } from 'payload';
import { hiddenUnless, isStaff, none, staffOrSelf } from '@/lib/access';
import { addButton, badgeCell, boolCell, emptyList, l, type Label, listOnly, say, scaledNumber, type StatusTab, statusTabs, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { ORDER_STATUSES, RESERVATION_STATUSES } from './order-states';
import { isLuxPostalCode, splitPostalCodes } from './zones';

// Orders, table reservations, slot rules and delivery zones (04 §4). Orders and reservations are written only by
// the sales services (placeOrder, transition, the reservation actions): staff read them in the admin, where one
// summary panel shows everything and the buttons offer only the moves the state machine allows.

export const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], Label> = {
  pending: l('À confirmer', 'To confirm', 'Zu bestätigen', 'Por confirmar'),
  awaiting_payment: l('Attend le virement', 'Awaiting transfer', 'Wartet auf Überweisung', 'A aguardar transferência'),
  confirmed: l('Confirmée', 'Confirmed', 'Bestätigt', 'Confirmada'),
  ready: l('Prête', 'Ready', 'Bereit', 'Pronta'),
  out_for_delivery: l('En livraison', 'Out for delivery', 'In Zustellung', 'Em entrega'),
  completed: l('Terminée', 'Completed', 'Abgeschlossen', 'Concluída'),
  cancelled: l('Annulée', 'Cancelled', 'Storniert', 'Cancelada'),
  refunded: l('Remboursée', 'Refunded', 'Erstattet', 'Reembolsada'),
};
export const ORDER_STATUS_TONES = {
  pending: 'warning',
  awaiting_payment: 'warning',
  confirmed: 'info',
  ready: 'success',
  out_for_delivery: 'info',
  completed: 'neutral',
  cancelled: 'danger',
  refunded: 'danger',
} as const;

export const RESERVATION_STATUS_LABELS: Record<(typeof RESERVATION_STATUSES)[number], Label> = {
  pending: l('À confirmer', 'To confirm', 'Zu bestätigen', 'Por confirmar'),
  accepted: l('Acceptée', 'Accepted', 'Angenommen', 'Aceite'),
  rejected: l('Refusée', 'Declined', 'Abgelehnt', 'Recusada'),
  cancelled: l('Annulée', 'Cancelled', 'Storniert', 'Cancelada'),
  completed: l('Client arrivé', 'Guests arrived', 'Gäste erschienen', 'Cliente chegou'),
  no_show: l('Client absent', 'No-show', 'Nicht erschienen', 'Não compareceu'),
};

/**
 * The table reservations list (QA 12 Nov, GG-04/06): today, what is coming (the sidebar opens it), each stage, and
 * the whole history. A day is a plain condition of its tab, so the counts always equal the lists.
 */
export const RESERVATION_TABS: StatusTab[] = [
  {
    label: l('Aujourd’hui', 'Today', 'Heute', 'Hoje'),
    statuses: ['pending', 'accepted', 'completed', 'no_show'],
    day: 'today',
    sort: 'slotAt',
    empty: l('Aucune réservation aujourd’hui', 'No reservations today', 'Heute keine Reservierungen', 'Sem reservas hoje'),
  },
  {
    label: l('À venir', 'Upcoming', 'Anstehend', 'Próximas'),
    statuses: ['pending', 'accepted'],
    day: 'fromToday',
    sort: 'slotAt',
    opens: true,
    empty: l('Aucune réservation à venir', 'No upcoming reservations', 'Keine anstehenden Reservierungen', 'Sem reservas futuras'),
  },
  {
    label: l('À confirmer', 'To confirm', 'Zu bestätigen', 'Por confirmar'),
    statuses: ['pending'],
    sort: 'slotAt',
    urgent: true,
    empty: l('Aucune réservation à confirmer', 'No reservations to confirm', 'Keine Reservierungen zu bestätigen', 'Sem reservas por confirmar'),
  },
  {
    label: l('Acceptées', 'Accepted', 'Angenommen', 'Aceites'),
    statuses: ['accepted'],
    sort: 'slotAt',
    empty: l('Aucune réservation acceptée en cours', 'No accepted reservations open', 'Keine offenen angenommenen Reservierungen', 'Sem reservas aceites em aberto'),
  },
  {
    label: l('Terminées', 'Completed', 'Abgeschlossen', 'Concluídas'),
    statuses: ['completed', 'no_show'],
    sort: '-slotAt',
    empty: l('Aucune réservation terminée', 'No completed reservations', 'Keine abgeschlossenen Reservierungen', 'Sem reservas concluídas'),
  },
  {
    label: l('Refusées / annulées', 'Declined / cancelled', 'Abgelehnt / storniert', 'Recusadas / canceladas'),
    statuses: ['rejected', 'cancelled'],
    sort: '-slotAt',
    empty: l('Aucune réservation refusée ou annulée', 'No declined or cancelled reservations', 'Keine abgelehnten oder stornierten Reservierungen', 'Sem reservas recusadas ou canceladas'),
  },
  {
    label: l('Toutes (historique)', 'All (history)', 'Alle (Verlauf)', 'Todas (histórico)'),
    sort: '-slotAt',
    empty: l('Aucune réservation pour l’instant', 'No reservations yet', 'Noch keine Reservierungen', 'Ainda sem reservas'),
  },
];
export const RESERVATION_STATUS_TONES = { pending: 'warning', accepted: 'success', rejected: 'danger', cancelled: 'danger', completed: 'neutral', no_show: 'danger' } as const;

export const MODE_LABELS = {
  pickup: l('À emporter', 'Pickup', 'Abholung', 'Levantamento'),
  delivery: l('Livraison', 'Delivery', 'Lieferung', 'Entrega'),
  table: l('Table', 'Table', 'Tisch', 'Mesa'),
  b2b: l('Professionnel', 'Business', 'Geschäftskunde', 'Profissional'),
  instore: l('En boutique', 'In store', 'Im Laden', 'Na loja'),
};
export type OrderMode = keyof typeof MODE_LABELS;
export const SLOT_MODES = ['pickup', 'delivery', 'table'] as const;
export type SlotMode = (typeof SLOT_MODES)[number];

export const PAYMENT_METHOD_LABELS = {
  onsite: l('Sur place', 'On site', 'Vor Ort', 'No local'),
  transfer: l('Virement', 'Bank transfer', 'Überweisung', 'Transferência'),
  invoice: l('Sur facture', 'On invoice', 'Auf Rechnung', 'Por fatura'),
  card: l('Carte', 'Card', 'Karte', 'Cartão'),
};
// GG-003/004: nothing is "paid" until staff record the money; a refund is "to do" until staff record it sent.
export const PAYMENT_STATUS_LABELS = {
  none: l('—', '—', '—', '—'),
  pending: l('En attente de paiement', 'Awaiting payment', 'Zahlung ausstehend', 'A aguardar pagamento'),
  partial: l('Partiellement payé', 'Partially paid', 'Teilweise bezahlt', 'Parcialmente pago'),
  authorized: l('Autorisé', 'Authorised', 'Autorisiert', 'Autorizado'),
  paid: l('Payé', 'Paid', 'Bezahlt', 'Pago'),
  refund_pending: l('Remboursement à effectuer', 'Refund pending', 'Erstattung ausstehend', 'Reembolso pendente'),
  partially_refunded: l('Partiellement remboursé', 'Partially refunded', 'Teilweise erstattet', 'Parcialmente reembolsado'),
  refunded: l('Remboursé', 'Refunded', 'Erstattet', 'Reembolsado'),
  voided: l('Annulé', 'Voided', 'Storniert', 'Anulado'),
};
export type PaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;
/** One colour code for every status pill (APPLUX report 4, §7): amber waits, blue is in progress, green is done, red is undone. */
export const PAYMENT_STATUS_TONES = {
  none: 'neutral',
  pending: 'warning',
  partial: 'warning',
  authorized: 'info',
  paid: 'success',
  refund_pending: 'danger',
  partially_refunded: 'neutral',
  refunded: 'neutral',
  voided: 'neutral',
} as const;

const options = <K extends string>(labels: Record<K, Label>) => (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

const contactGroup = (cell?: string): Field => ({
  name: 'contact',
  type: 'group',
  label: l('Client', 'Customer', 'Kunde', 'Cliente'),
  admin: cell ? { components: { Cell: cell } } : undefined,
  fields: [
    { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome') },
    { name: 'email', type: 'email', required: true, label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail') },
    { name: 'phone', type: 'text', required: true, label: l('Téléphone', 'Phone', 'Telefon', 'Telefone') },
  ],
});

const localeField: Field = {
  name: 'locale',
  type: 'select',
  required: true,
  defaultValue: 'fr',
  label: l('Langue du client', 'Customer’s language', 'Sprache des Kunden', 'Língua do cliente'),
  options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
};

/** Kept for the services, never a list column or filter: technical values (cents, ids, copies) staff never pick (GG-07). */
const internal = { disableListColumn: true, disableListFilter: true } as const;

/**
 * `internal` on a list's or group's fields too: Payload offers nested fields in its filters even when the parent is
 * not. `rows`: the fields of a list (array), with Payload's own row id (generated as usual) hidden as well.
 */
const hidden = (fields: Field[], rows = false): Field[] => [
  ...fields.map((f) => ({ ...f, admin: { ...('admin' in f ? f.admin : {}), ...internal }, ...('fields' in f ? { fields: hidden(f.fields) } : {}) }) as Field),
  ...(rows ? [{ ...baseIDField, admin: { ...baseIDField.admin, ...internal } } as Field] : []),
];

const historyFields = hidden([{ name: 'at', type: 'date' }, { name: 'from', type: 'text' }, { name: 'to', type: 'text' }, { name: 'user', type: 'relationship', relationTo: 'users' }, { name: 'reason', type: 'text' }], true);

const lineFields: Field[] = [
  { name: 'variant', type: 'relationship', relationTo: 'variants', required: true },
  { name: 'unit', type: 'relationship', relationTo: 'packagingUnits' },
  { name: 'unitQty', type: 'number', required: true },
  { name: 'baseQty', type: 'number', required: true },
  { name: 'name', type: 'text', required: true },
  { name: 'detail', type: 'text' },
  { name: 'unitPriceCents', type: 'number', required: true },
  { name: 'discountCents', type: 'number', defaultValue: 0 },
  { name: 'vatBp', type: 'number', required: true },
  { name: 'totalCents', type: 'number', required: true },
];

export const orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: l('Commande', 'Order', 'Bestellung', 'Encomenda'), plural: l('Commandes', 'Orders', 'Bestellungen', 'Encomendas') },
  admin: {
    useAsTitle: 'number',
    // What staff act on (QA 12 Nov, GG-07): number, slot, pickup or delivery, customer, payment, total, stage.
    defaultColumns: ['number', 'slot', 'mode', 'contact', 'payment', 'totals', 'status'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['number', 'contact.name', 'contact.email', 'contact.phone'],
    description: l(
      'Les commandes du site, rangées par étape. Ouvrez-en une pour la confirmer, la préparer ou l’annuler.',
      'Website orders, by stage. Open one to confirm, prepare or cancel it.',
      'Bestellungen der Website, nach Schritt sortiert. Öffnen Sie eine, um sie zu bestätigen, vorzubereiten oder zu stornieren.',
      'As encomendas do site, por etapa. Abra uma para a confirmar, preparar ou cancelar.',
    ),
    // The stage tabs, the slot-day filter and each tab's empty state (GG-001).
    components: { beforeListTable: ['@/modules/sales/admin/order-tabs'] },
  },
  // Written only by the sales services, which run with overrideAccess (02 §6; status through transition()).
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'panel', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/modules/sales/admin/order-panel' } } },
    ...[
      { name: 'number', type: 'text', required: true, unique: true, label: l('Numéro', 'Number', 'Nummer', 'Número') },
      {
        name: 'status',
        type: 'select',
        required: true,
        defaultValue: 'pending',
        index: true,
        label: l('Statut', 'Status', 'Status', 'Estado'),
        options: options(ORDER_STATUS_LABELS),
        admin: { components: badgeCell(ORDER_STATUS_TONES) },
      },
      {
        name: 'channel',
        type: 'select',
        required: true,
        defaultValue: 'webshop',
        index: true,
        label: l('Canal', 'Channel', 'Kanal', 'Canal'),
        options: [
          { value: 'webshop', label: l('Site', 'Website', 'Website', 'Site') },
          { value: 'mobile', label: l('Vente mobile', 'Mobile sale', 'Mobiler Verkauf', 'Venda móvel') },
          { value: 'pos', label: l('Caisse', 'Till', 'Kasse', 'Caixa') },
        ],
      },
      { name: 'mode', type: 'select', required: true, label: l('Type', 'Type', 'Art', 'Tipo'), options: options(MODE_LABELS), admin: { components: { Cell: '@/modules/sales/admin/cells#ModeCell' } } },
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: internal },
      { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente') },
      contactGroup('@/modules/sales/admin/cells#ContactCell'),
      {
        name: 'address',
        type: 'group',
        label: l('Adresse de livraison', 'Delivery address', 'Lieferadresse', 'Morada de entrega'),
        // An optional column on one line (GG-07); the code postal and the town can be filtered.
        admin: { components: { Cell: '@/modules/sales/admin/cells#AddressCell' } },
        fields: [
          { name: 'line1', type: 'text', label: l('Rue et numéro', 'Street and number', 'Straße und Nummer', 'Rua e número'), admin: { disableListColumn: true } },
          { name: 'line2', type: 'text', label: l('Complément', 'Address line 2', 'Adresszusatz', 'Complemento'), admin: internal },
          { name: 'postalCode', type: 'text', label: l('Code postal', 'Postcode', 'Postleitzahl', 'Código postal'), admin: { disableListColumn: true } },
          { name: 'city', type: 'text', label: l('Localité', 'Town', 'Ort', 'Localidade'), admin: { disableListColumn: true } },
          { name: 'country', type: 'text', label: l('Pays', 'Country', 'Land', 'País'), admin: internal },
        ],
      },
      {
        name: 'slot',
        type: 'group',
        label: l('Créneau', 'Time slot', 'Zeitfenster', 'Horário'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#SlotCell' } },
        fields: [
          // The slot is one column (its cell); its day stays a filter.
          { name: 'date', type: 'text', label: l('Jour', 'Day', 'Tag', 'Dia'), admin: { disableListColumn: true } },
          { name: 'from', type: 'text', label: l('De', 'From', 'Von', 'De'), admin: internal },
          { name: 'to', type: 'text', label: l('À', 'To', 'Bis', 'Até'), admin: internal },
        ],
      },
      // `YYYY-MM-DDTHH:mm` of the slot: the list's "today and upcoming" filter and its sort.
      { name: 'slotAt', type: 'text', index: true, label: l('Créneau', 'Time slot', 'Zeitfenster', 'Horário'), admin: { disableListColumn: true } },
      { name: 'lines', type: 'array', label: l('Articles', 'Items', 'Artikel', 'Artigos'), admin: internal, fields: hidden(lineFields, true) },
      {
        name: 'totals',
        type: 'group',
        label: l('Total', 'Total', 'Summe', 'Total'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#TotalCell' } },
        // The total shows in euros through its cell; the amounts in cents behind it are never columns (GG-07).
        fields: [
          { name: 'subtotalCents', type: 'number', required: true, admin: internal },
          { name: 'discountCents', type: 'number', defaultValue: 0, admin: internal },
          { name: 'deliveryCents', type: 'number', defaultValue: 0, admin: internal },
          { name: 'vatCents', type: 'number', required: true, admin: internal },
          { name: 'totalCents', type: 'number', required: true, admin: internal },
          { name: 'vatBreakdown', type: 'array', admin: internal, fields: hidden([{ name: 'rateBp', type: 'number' }, { name: 'baseCents', type: 'number' }, { name: 'vatCents', type: 'number' }], true) },
        ],
      },
      {
        name: 'payment',
        type: 'group',
        label: l('Paiement', 'Payment', 'Zahlung', 'Pagamento'),
        // One column: the payment's state as a badge and its method (GG-07/08: transfers awaited stand out).
        admin: { components: { Cell: { path: '@/modules/sales/admin/cells#PaymentCell', clientProps: { tones: PAYMENT_STATUS_TONES, states: PAYMENT_STATUS_LABELS, methods: PAYMENT_METHOD_LABELS } } } },
        fields: [
          { name: 'provider', type: 'select', defaultValue: 'manual', options: ['manual', 'wallee'], admin: internal },
          { name: 'method', type: 'select', options: options(PAYMENT_METHOD_LABELS), label: l('Moyen de paiement', 'Payment method', 'Zahlungsart', 'Meio de pagamento'), admin: { disableListColumn: true } },
          { name: 'status', type: 'select', defaultValue: 'none', options: options(PAYMENT_STATUS_LABELS), label: l('État du paiement', 'Payment state', 'Zahlungsstand', 'Estado do pagamento'), admin: { disableListColumn: true } },
          { name: 'ref', type: 'text', admin: internal },
          // Kept equal to the sums of the order's `payments` rows (service.ts), plus the refund staff asked for.
          { name: 'paidCents', type: 'number', defaultValue: 0, admin: internal },
          { name: 'refundedCents', type: 'number', defaultValue: 0, admin: internal },
          { name: 'refundDueCents', type: 'number', defaultValue: 0, admin: internal },
          { name: 'refundReason', type: 'text', admin: internal },
          // The bank account this order's customer was told to pay into (transfer orders): a copy taken when the
          // order is placed or when staff choose another one, so a later change of the settings never alters it.
          {
            name: 'bankAccount',
            type: 'group',
            admin: internal,
            fields: hidden([
              { name: 'holder', type: 'text' },
              { name: 'bankName', type: 'text' },
              { name: 'iban', type: 'text' },
              { name: 'bic', type: 'text' },
            ]),
          },
        ],
      },
      localeField,
      { name: 'staff', type: 'relationship', relationTo: 'users', admin: internal },
      { name: 'stockPosted', type: 'checkbox', defaultValue: false, admin: internal },
      { name: 'notes', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente') },
      { name: 'history', type: 'array', admin: internal, fields: historyFields },
    ].map((f) => listOnly(f as Field)),
  ],
  custom: {
    indexes: [
      { fields: { status: 1, createdAt: -1 } },
      { fields: { customer: 1, createdAt: -1 } },
      { fields: { channel: 1, createdAt: -1 } },
      { fields: { 'slot.date': 1, mode: 1 } },
      // Refunds still to send: read by the sidebar, the bell and the dashboard on every page.
      { fields: { 'payment.status': 1 }, options: { name: 'refund_pending', partialFilterExpression: { 'payment.status': 'refund_pending' } } },
    ],
  },
};

export const reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: l('Réservation', 'Reservation', 'Reservierung', 'Reserva'), plural: l('Réservations', 'Reservations', 'Reservierungen', 'Reservas') },
  admin: {
    useAsTitle: 'number',
    defaultColumns: ['number', 'slot', 'contact', 'guests', 'status', 'attendance', 'preorder'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['number', 'contact.name', 'contact.email', 'contact.phone'],
    description: l(
      'Les demandes de table du site. Acceptez ou refusez : le client reçoit un e-mail dans sa langue.',
      'Table requests from the website. Accept or decline: the customer gets an e-mail in their language.',
      'Tischanfragen von der Website. Annehmen oder ablehnen: der Kunde erhält eine E-Mail in seiner Sprache.',
      'Pedidos de mesa do site. Aceite ou recuse: o cliente recebe um e-mail na sua língua.',
    ),
    // Stage tabs instead of the filter builder (APPLUX report 4, §7), each with its own empty message (GG-04).
    components: { beforeListTable: [statusTabs('reservations', RESERVATION_TABS, 'reservations')] },
  },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'panel', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/modules/sales/admin/reservation-panel' } } },
    ...[
      { name: 'number', type: 'text', required: true, unique: true, label: l('Numéro', 'Number', 'Nummer', 'Número') },
      {
        name: 'status',
        type: 'select',
        required: true,
        defaultValue: 'pending',
        label: l('Statut', 'Status', 'Status', 'Estado'),
        options: options(RESERVATION_STATUS_LABELS),
        admin: { components: badgeCell(RESERVATION_STATUS_TONES) },
      },
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: internal },
      { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente') },
      contactGroup('@/modules/sales/admin/cells#ContactCell'),
      {
        name: 'slot',
        type: 'group',
        label: l('Date et heure', 'Date and time', 'Datum und Uhrzeit', 'Data e hora'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#SlotCell' } },
        fields: [
          { name: 'date', type: 'text', required: true, label: l('Jour', 'Day', 'Tag', 'Dia'), admin: { disableListColumn: true } },
          { name: 'from', type: 'text', required: true, label: l('Heure', 'Time', 'Uhrzeit', 'Hora'), admin: internal },
          { name: 'to', type: 'text', label: l('Jusqu’à', 'Until', 'Bis', 'Até'), admin: internal },
        ],
      },
      { name: 'slotAt', type: 'text', index: true, label: l('Date et heure', 'Date and time', 'Datum und Uhrzeit', 'Data e hora'), admin: { disableListColumn: true } },
      { name: 'guests', type: 'number', required: true, min: 1, label: l('Personnes', 'Guests', 'Personen', 'Pessoas') },
      {
        name: 'preorder',
        type: 'relationship',
        relationTo: 'orders',
        label: l('Pré-commande', 'Pre-order', 'Vorbestellung', 'Pré-encomenda'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#PreorderCell' } },
      },
      { name: 'notes', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente') },
      localeField,
      { name: 'history', type: 'array', admin: internal, fields: historyFields },
      // Arrived / absent straight from the list during service (GG-05): buttons on accepted rows, nothing stored.
      { name: 'attendance', type: 'ui', label: l('Présence', 'Attendance', 'Anwesenheit', 'Presença'), admin: { components: { Cell: '@/modules/sales/admin/cells#AttendanceCell' } } },
    ].map((f) => listOnly(f as Field)),
  ],
  custom: { indexes: [{ fields: { 'slot.date': 1, status: 1 } }] },
};

const MODE_OPTIONS = SLOT_MODES.map((value) => ({ value, label: MODE_LABELS[value] }));

export const slotRules: CollectionConfig = {
  slug: 'slotRules',
  labels: { singular: l('Créneaux', 'Time slots', 'Zeitfenster', 'Horários'), plural: l('Créneaux', 'Time slots', 'Zeitfenster', 'Horários') },
  admin: {
    useAsTitle: 'mode',
    defaultColumns: ['mode', 'intervalMin', 'capacityPerSlot', 'leadTimeMin', 'maxDaysAhead'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Comment le site propose les heures : une règle pour l’emporter, une pour la livraison, une pour les tables.',
      'How the website offers times: one rule for pickup, one for delivery, one for tables.',
      'Wie die Website Zeiten anbietet: eine Regel für Abholung, eine für Lieferung, eine für Tische.',
      'Como o site propõe as horas: uma regra para levantamento, uma para entrega, uma para mesas.',
    ),
    components: addButton('slotRules', l('Ajouter une règle', 'Add a rule', 'Regel hinzufügen', 'Adicionar uma regra')),
  },
  access: { read: isStaff(), create: isStaff('manager'), update: isStaff('manager'), delete: isStaff('manager') },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'mode',
          type: 'select',
          required: true,
          unique: true,
          label: l('Pour', 'For', 'Für', 'Para'),
          options: MODE_OPTIONS,
          admin: { width: '50%', isClearable: false },
        },
        {
          name: 'intervalMin',
          type: 'number',
          required: true,
          min: 5,
          defaultValue: 30,
          label: l('Un créneau toutes les (minutes)', 'One slot every (minutes)', 'Ein Zeitfenster alle (Minuten)', 'Um horário a cada (minutos)'),
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'capacityPerSlot',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 4,
          // GG-024: what is counted differs by mode; the label and text say exactly how.
          label: l('Capacité par créneau', 'Capacity per slot', 'Kapazität pro Zeitfenster', 'Capacidade por horário'),
          admin: {
            width: '33%',
            description: l(
              'À emporter et livraison : nombre de commandes par créneau. Tables : nombre de personnes (couverts) qui peuvent arriver dans le créneau ; une table de 2 en utilise 2, une table de 10 en utilise 10. La durée du repas n’est pas comptée.',
              'Pickup and delivery: number of orders per slot. Tables: number of guests (covers) who can arrive in the slot; a table for 2 uses 2, a table for 10 uses 10. How long the meal lasts is not counted.',
              'Abholung und Lieferung: Anzahl Bestellungen pro Zeitfenster. Tische: Anzahl Personen (Gedecke), die im Zeitfenster ankommen können; ein Tisch für 2 belegt 2, ein Tisch für 10 belegt 10. Die Dauer des Essens wird nicht berücksichtigt.',
              'Levantamento e entrega: número de encomendas por horário. Mesas: número de pessoas (lugares) que podem chegar no horário; uma mesa para 2 usa 2, uma mesa para 10 usa 10. A duração da refeição não é contada.',
            ),
          },
        },
        {
          name: 'leadTimeMin',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 60,
          label: l('Délai minimum (minutes)', 'Notice needed (minutes)', 'Vorlaufzeit (Minuten)', 'Antecedência (minutos)'),
          admin: { width: '33%', description: l('Le temps de préparer.', 'Time to prepare.', 'Zeit zur Vorbereitung.', 'Tempo para preparar.') },
        },
        {
          name: 'maxDaysAhead',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 14,
          label: l('Jusqu’à (jours à l’avance)', 'Up to (days ahead)', 'Bis zu (Tage im Voraus)', 'Até (dias de antecedência)'),
          admin: {
            width: '33%',
            description: l(
              '0 : aujourd’hui seulement. 14 : jusqu’au même jour dans deux semaines.',
              '0: today only. 14: up to the same weekday two weeks from now.',
              '0: nur heute. 14: bis zum selben Wochentag in zwei Wochen.',
              '0: só hoje. 14: até ao mesmo dia daqui a duas semanas.',
            ),
          },
        },
      ],
    },
    {
      name: 'lastCallMin',
      type: 'number',
      min: 0,
      defaultValue: 0,
      label: l('Dernière arrivée (minutes avant la fermeture)', 'Last arrival (minutes before closing)', 'Letzte Ankunft (Minuten vor Schließung)', 'Última chegada (minutos antes do fecho)'),
      // GG-025: the last booking can be earlier than the closing time (kitchen closes at 14:00, last table 13:30).
      admin: {
        description: l(
          '0 : le dernier créneau se termine à la fermeture. 30 : rien ne commence moins de 30 min avant la fermeture (cuisine fermant à 14:00 → dernière arrivée 13:30). Les tables restent à confirmer par la Maison.',
          '0: the last slot ends at closing time. 30: nothing starts less than 30 min before closing (kitchen closing at 14:00 → last arrival 13:30). Tables are still confirmed by the House.',
          '0: das letzte Zeitfenster endet bei Schließung. 30: nichts beginnt weniger als 30 Min. vor Schließung (Küche schließt 14:00 → letzte Ankunft 13:30). Tische werden weiterhin vom Haus bestätigt.',
          '0: o último horário termina ao fecho. 30: nada começa menos de 30 min antes do fecho (cozinha fecha às 14:00 → última chegada 13:30). As mesas continuam a ser confirmadas pela Casa.',
        ),
      },
    },
    { name: 'daysBulk', type: 'ui', admin: { components: { Field: { path: '@/components/admin/weekday-bulk', clientProps: { array: 'days' } } } } },
    {
      name: 'days',
      type: 'array',
      label: l('Horaires propres (facultatif)', 'Own hours (optional)', 'Eigene Zeiten (optional)', 'Horário próprio (opcional)'),
      labels: { singular: l('Créneau', 'Time range', 'Zeitraum', 'Período'), plural: l('Créneaux', 'Time ranges', 'Zeiträume', 'Períodos') },
      admin: {
        description: l(
          'Vide : les horaires d’ouverture de la boutique. Sinon, seulement ces jours et heures.',
          'Empty: the shop’s opening hours. Otherwise, only these days and times.',
          'Leer: die Öffnungszeiten des Geschäfts. Sonst nur diese Tage und Zeiten.',
          'Vazio: o horário da loja. Caso contrário, só estes dias e horas.',
        ),
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'day', type: 'select', required: true, options: WEEKDAYS, label: l('Jour', 'Day', 'Tag', 'Dia'), admin: { width: '40%', isClearable: false } },
            timeOfDay('open', l('De', 'From', 'Von', 'De'), '30%'),
            timeOfDay('close', l('À', 'To', 'Bis', 'Até'), '30%'),
          ],
        },
      ],
    },
    // Bumped inside every booking transaction: two bookings of one mode conflict, so the second recounts (service.ts).
    { name: 'lockVersion', type: 'number', defaultValue: 0, admin: { hidden: true } },
  ],
};

export const deliveryZones: CollectionConfig = {
  slug: 'deliveryZones',
  labels: { singular: l('Zone de livraison', 'Delivery area', 'Liefergebiet', 'Zona de entrega'), plural: l('Zones de livraison', 'Delivery areas', 'Liefergebiete', 'Zonas de entrega') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'postalCodes', 'feeCents', 'minOrderCents', 'freeFromCents', 'active'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Où vous livrez, à quel prix et à partir de quel montant. Un code postal hors zone se voit proposer l’emporter.',
      'Where you deliver, at what price and from which amount. A postcode outside every area is offered pickup.',
      'Wohin Sie liefern, zu welchem Preis und ab welchem Betrag. Eine Postleitzahl außerhalb wird zur Abholung eingeladen.',
      'Onde entrega, a que preço e a partir de que valor. Um código postal fora de zona é convidado a levantar.',
    ),
    components: {
      ...addButton('deliveryZones', l('Ajouter une zone', 'Add an area', 'Gebiet hinzufügen', 'Adicionar uma zona')),
      ...emptyList({
        icon: 'zones',
        title: l('Aucune zone de livraison', 'No delivery areas yet', 'Noch keine Liefergebiete', 'Ainda sem zonas de entrega'),
        text: l(
          'Sans zone, la livraison n’est proposée à personne. Ajoutez les codes postaux que vous desservez.',
          'Without an area, delivery is offered to nobody. Add the postcodes you serve.',
          'Ohne Gebiet wird niemandem Lieferung angeboten. Fügen Sie die belieferten Postleitzahlen hinzu.',
          'Sem zona, a entrega não é proposta a ninguém. Adicione os códigos postais que serve.',
        ),
        action: l('Ajouter une zone', 'Add an area', 'Gebiet hinzufügen', 'Adicionar uma zona'),
      }),
    },
  },
  access: { read: isStaff(), create: isStaff('manager'), update: isStaff('manager'), delete: isStaff('manager') },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, label: l('Nom de la zone', 'Area name', 'Name des Gebiets', 'Nome da zona'), admin: { width: '70%', placeholder: 'Bissen et environs' } },
        { name: 'active', type: 'checkbox', defaultValue: true, label: l('Active', 'Active', 'Aktiv', 'Ativa'), admin: { width: '30%', style: { alignSelf: 'flex-end' }, components: boolCell() } },
      ],
    },
    // GG-036: paste several codes at once (the box above the field), and anything pasted into the field itself is
    // split and cleaned when saved.
    { name: 'postalCodesPaste', type: 'ui', admin: { components: { Field: { path: '@/modules/sales/admin/postcode-paste', clientProps: { field: 'postalCodes' } } } } },
    {
      name: 'postalCodes',
      type: 'text',
      hasMany: true,
      required: true,
      index: true,
      label: l('Codes postaux', 'Postcodes', 'Postleitzahlen', 'Códigos postais'),
      hooks: { beforeValidate: [({ value }) => (Array.isArray(value) ? splitPostalCodes(value.map(String)) : value)] },
      validate: (value: string[] | null | undefined, { req }: { req: PayloadRequest }) => {
        const wrong = (value ?? []).filter((c) => !isLuxPostalCode(c));
        if (wrong.length === 0) return (value ?? []).length > 0 || say(req, l('Ajoutez au moins un code postal.', 'Add at least one postcode.', 'Mindestens eine Postleitzahl angeben.', 'Indique pelo menos um código postal.'));
        return say(
          req,
          l(
            `Pas un code postal luxembourgeois (4 chiffres) : ${wrong.join(', ')}`,
            `Not a Luxembourg postcode (4 digits): ${wrong.join(', ')}`,
            `Keine luxemburgische Postleitzahl (4 Ziffern): ${wrong.join(', ')}`,
            `Não é um código postal luxemburguês (4 algarismos): ${wrong.join(', ')}`,
          ),
        );
      },
      admin: {
        description: l(
          'Tapez un code et Entrée, ou collez-en plusieurs dans la case au-dessus. « L-7795 » et « 7795 » sont pareils.',
          'Type a code and press Enter, or paste several in the box above. “L-7795” and “7795” are the same.',
          'Code eingeben und Enter drücken, oder mehrere im Feld darüber einfügen. „L-7795“ und „7795“ sind gleich.',
          'Escreva um código e Enter, ou cole vários na caixa acima. «L-7795» e «7795» são iguais.',
        ),
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'feeCents', type: 'number', required: true, min: 0, label: l('Frais de livraison', 'Delivery fee', 'Liefergebühr', 'Taxa de entrega'), admin: { width: '33%', components: scaledNumber('€') } },
        { name: 'minOrderCents', type: 'number', required: true, min: 0, defaultValue: 0, label: l('Commande minimum', 'Minimum order', 'Mindestbestellwert', 'Encomenda mínima'), admin: { width: '33%', components: scaledNumber('€') } },
        {
          name: 'freeFromCents',
          type: 'number',
          min: 0,
          label: l('Gratuite dès (facultatif)', 'Free from (optional)', 'Kostenlos ab (optional)', 'Grátis a partir de (opcional)'),
          admin: { width: '33%', components: scaledNumber('€') },
        },
      ],
    },
  ],
};

export const salesCollections = [orders, reservations, slotRules, deliveryZones];
