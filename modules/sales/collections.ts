import type { CollectionConfig, Field } from 'payload';
import { hiddenUnless, isStaff, none, staffOrSelf } from '@/lib/access';
import { addButton, badgeCell, emptyList, l, type Label, listOnly, scaledNumber, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { ORDER_STATUSES, RESERVATION_STATUSES } from './order-states';

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
  completed: l('Venue', 'Completed', 'Erledigt', 'Concluída'),
};
export const RESERVATION_STATUS_TONES = { pending: 'warning', accepted: 'success', rejected: 'danger', cancelled: 'danger', completed: 'neutral' } as const;

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
export const PAYMENT_STATUS_LABELS = {
  none: l('—', '—', '—', '—'),
  pending: l('À payer', 'To be paid', 'Offen', 'Por pagar'),
  authorized: l('Autorisé', 'Authorised', 'Autorisiert', 'Autorizado'),
  paid: l('Payé', 'Paid', 'Bezahlt', 'Pago'),
  refunded: l('Remboursé', 'Refunded', 'Erstattet', 'Reembolsado'),
  voided: l('Annulé', 'Voided', 'Storniert', 'Anulado'),
};

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
    defaultColumns: ['number', 'slot', 'mode', 'contact', 'totals', 'status', 'channel'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['number', 'contact.name', 'contact.email', 'contact.phone'],
    description: l(
      'Les commandes du site, de la plus proche à la plus lointaine. Ouvrez-en une pour la confirmer, la préparer ou l’annuler.',
      'Website orders, soonest first. Open one to confirm, prepare or cancel it.',
      'Bestellungen der Website, die nächste zuerst. Öffnen Sie eine, um sie zu bestätigen, vorzubereiten oder zu stornieren.',
      'As encomendas do site, da mais próxima à mais distante. Abra uma para a confirmar, preparar ou cancelar.',
    ),
    components: emptyList({
      icon: 'orders',
      title: l('Aucune commande à venir', 'No upcoming orders', 'Keine anstehenden Bestellungen', 'Sem encomendas futuras'),
      text: l(
        'Les commandes passées sur le site apparaissent ici, avec leur créneau. Retirez le filtre pour voir les anciennes.',
        'Orders placed on the website appear here with their time slot. Remove the filter to see past ones.',
        'Auf der Website aufgegebene Bestellungen erscheinen hier mit ihrem Zeitfenster. Entfernen Sie den Filter für ältere.',
        'As encomendas feitas no site aparecem aqui, com o horário. Retire o filtro para ver as antigas.',
      ),
      evenFiltered: true,
    }),
  },
  // Written only by the sales services, which run with overrideAccess (02 §6; status through transition()).
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'panel', type: 'ui', admin: { components: { Field: '@/modules/sales/admin/order-panel' } } },
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
      { name: 'mode', type: 'select', required: true, label: l('Type', 'Type', 'Art', 'Tipo'), options: options(MODE_LABELS) },
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: { disableListColumn: true, disableListFilter: true } },
      { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente') },
      contactGroup('@/modules/sales/admin/cells#ContactCell'),
      {
        name: 'address',
        type: 'group',
        label: l('Adresse de livraison', 'Delivery address', 'Lieferadresse', 'Morada de entrega'),
        admin: { disableListColumn: true },
        fields: [
          { name: 'line1', type: 'text' },
          { name: 'line2', type: 'text' },
          { name: 'postalCode', type: 'text' },
          { name: 'city', type: 'text' },
          { name: 'country', type: 'text' },
        ],
      },
      {
        name: 'slot',
        type: 'group',
        label: l('Créneau', 'Time slot', 'Zeitfenster', 'Horário'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#SlotCell' } },
        fields: [
          { name: 'date', type: 'text', label: l('Jour', 'Day', 'Tag', 'Dia') },
          { name: 'from', type: 'text', label: l('De', 'From', 'Von', 'De') },
          { name: 'to', type: 'text', label: l('À', 'To', 'Bis', 'Até') },
        ],
      },
      // `YYYY-MM-DDTHH:mm` of the slot: the list's "today and upcoming" filter and its sort.
      { name: 'slotAt', type: 'text', index: true, label: l('Créneau', 'Time slot', 'Zeitfenster', 'Horário'), admin: { disableListColumn: true } },
      { name: 'lines', type: 'array', label: l('Articles', 'Items', 'Artikel', 'Artigos'), admin: { disableListColumn: true }, fields: lineFields },
      {
        name: 'totals',
        type: 'group',
        label: l('Total', 'Total', 'Summe', 'Total'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#TotalCell' } },
        fields: [
          { name: 'subtotalCents', type: 'number', required: true },
          { name: 'discountCents', type: 'number', defaultValue: 0 },
          { name: 'deliveryCents', type: 'number', defaultValue: 0 },
          { name: 'vatCents', type: 'number', required: true },
          { name: 'totalCents', type: 'number', required: true },
          { name: 'vatBreakdown', type: 'array', fields: [{ name: 'rateBp', type: 'number' }, { name: 'baseCents', type: 'number' }, { name: 'vatCents', type: 'number' }] },
        ],
      },
      {
        name: 'payment',
        type: 'group',
        label: l('Paiement', 'Payment', 'Zahlung', 'Pagamento'),
        admin: { disableListColumn: true },
        fields: [
          { name: 'provider', type: 'select', defaultValue: 'manual', options: ['manual', 'wallee'] },
          { name: 'method', type: 'select', options: options(PAYMENT_METHOD_LABELS), label: l('Moyen', 'Method', 'Art', 'Meio') },
          { name: 'status', type: 'select', defaultValue: 'none', options: options(PAYMENT_STATUS_LABELS), label: l('État', 'State', 'Stand', 'Estado') },
          { name: 'ref', type: 'text' },
        ],
      },
      localeField,
      { name: 'staff', type: 'relationship', relationTo: 'users', admin: { disableListColumn: true } },
      { name: 'stockPosted', type: 'checkbox', defaultValue: false, admin: { disableListColumn: true } },
      { name: 'notes', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente') },
      { name: 'history', type: 'array', admin: { disableListColumn: true }, fields: [{ name: 'at', type: 'date' }, { name: 'from', type: 'text' }, { name: 'to', type: 'text' }, { name: 'user', type: 'relationship', relationTo: 'users' }, { name: 'reason', type: 'text' }] },
    ].map((f) => listOnly(f as Field)),
  ],
  custom: {
    indexes: [
      { fields: { status: 1, createdAt: -1 } },
      { fields: { customer: 1, createdAt: -1 } },
      { fields: { channel: 1, createdAt: -1 } },
      { fields: { 'slot.date': 1, mode: 1 } },
    ],
  },
};

export const reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: l('Réservation', 'Reservation', 'Reservierung', 'Reserva'), plural: l('Réservations', 'Reservations', 'Reservierungen', 'Reservas') },
  admin: {
    useAsTitle: 'number',
    defaultColumns: ['number', 'slot', 'guests', 'contact', 'preorder', 'status'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['number', 'contact.name', 'contact.email', 'contact.phone'],
    description: l(
      'Les demandes de table du site. Acceptez ou refusez : le client reçoit un e-mail dans sa langue.',
      'Table requests from the website. Accept or decline: the customer gets an e-mail in their language.',
      'Tischanfragen von der Website. Annehmen oder ablehnen: der Kunde erhält eine E-Mail in seiner Sprache.',
      'Pedidos de mesa do site. Aceite ou recuse: o cliente recebe um e-mail na sua língua.',
    ),
    components: emptyList({
      icon: 'reservations',
      title: l('Aucune réservation à venir', 'No upcoming reservations', 'Keine anstehenden Reservierungen', 'Sem reservas futuras'),
      text: l(
        'Les demandes de table envoyées depuis le site apparaissent ici. Retirez le filtre pour voir les anciennes.',
        'Table requests sent from the website appear here. Remove the filter to see past ones.',
        'Tischanfragen von der Website erscheinen hier. Entfernen Sie den Filter für ältere.',
        'Os pedidos de mesa enviados pelo site aparecem aqui. Retire o filtro para ver os antigos.',
      ),
      evenFiltered: true,
    }),
  },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'panel', type: 'ui', admin: { components: { Field: '@/modules/sales/admin/reservation-panel' } } },
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
      { name: 'idempotencyKey', type: 'text', required: true, unique: true, admin: { disableListColumn: true, disableListFilter: true } },
      { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente') },
      contactGroup('@/modules/sales/admin/cells#ContactCell'),
      {
        name: 'slot',
        type: 'group',
        label: l('Date et heure', 'Date and time', 'Datum und Uhrzeit', 'Data e hora'),
        admin: { components: { Cell: '@/modules/sales/admin/cells#SlotCell' } },
        fields: [
          { name: 'date', type: 'text', required: true, label: l('Jour', 'Day', 'Tag', 'Dia') },
          { name: 'from', type: 'text', required: true, label: l('Heure', 'Time', 'Uhrzeit', 'Hora') },
          { name: 'to', type: 'text', label: l('Jusqu’à', 'Until', 'Bis', 'Até') },
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
      { name: 'history', type: 'array', admin: { disableListColumn: true }, fields: [{ name: 'at', type: 'date' }, { name: 'from', type: 'text' }, { name: 'to', type: 'text' }, { name: 'user', type: 'relationship', relationTo: 'users' }] },
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
          label: l('Places par créneau', 'Places per slot', 'Plätze pro Zeitfenster', 'Lugares por horário'),
          admin: {
            width: '33%',
            description: l('Commandes ; pour les tables : personnes.', 'Orders; for tables: guests.', 'Bestellungen; bei Tischen: Personen.', 'Encomendas; para mesas: pessoas.'),
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
          admin: { width: '33%' },
        },
      ],
    },
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
        { name: 'active', type: 'checkbox', defaultValue: true, label: l('Active', 'Active', 'Aktiv', 'Ativa'), admin: { width: '30%', style: { alignSelf: 'flex-end' } } },
      ],
    },
    {
      name: 'postalCodes',
      type: 'text',
      hasMany: true,
      required: true,
      index: true,
      label: l('Codes postaux', 'Postcodes', 'Postleitzahlen', 'Códigos postais'),
      admin: {
        description: l(
          'Tapez un code et Entrée. « L-7795 » et « 7795 » sont pareils.',
          'Type a code and press Enter. “L-7795” and “7795” are the same.',
          'Code eingeben und Enter drücken. „L-7795“ und „7795“ sind gleich.',
          'Escreva um código e Enter. «L-7795» e «7795» são iguais.',
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
