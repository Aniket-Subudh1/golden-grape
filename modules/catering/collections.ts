import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, none, publicRead } from '@/lib/access';
import { addButton, l, scaledNumber } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { revalidateTagHook } from '@/lib/revalidate';

/** Request statuses with their everyday names (also shown on the dashboard). */
export const REQUEST_STATUS = [
  { value: 'new', label: l('Nouvelle', 'New', 'Neu', 'Novo') },
  // "Devis envoyé" (`quoted`) returns with catering quotations, set only when a quotation is really sent (APPLUX, §1).
  { value: 'contacted', label: l('Client contacté', 'Customer contacted', 'Kunde kontaktiert', 'Cliente contactado') },
  { value: 'accepted', label: l('Acceptée', 'Accepted', 'Angenommen', 'Aceite') },
  { value: 'declined', label: l('Refusée', 'Declined', 'Abgelehnt', 'Recusado') },
];

export const cateringPackages: CollectionConfig = {
  slug: 'cateringPackages',
  labels: {
    singular: l('Menu traiteur', 'Catering menu', 'Catering-Menü', 'Menu de catering'),
    plural: l('Menus traiteur', 'Catering menus', 'Catering-Menüs', 'Menus de catering'),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'pricePerGuestCents', 'minGuests'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les formules de la page Traiteur, dans l’ordre choisi.',
      'The menus on the Catering page, in the order you choose.',
      'Die Menüs der Catering-Seite, in Ihrer Reihenfolge.',
      'Os menus da página Catering, pela ordem escolhida.',
    ),
    components: addButton('cateringPackages', l('Ajouter un menu', 'Add a menu', 'Menü hinzufügen', 'Adicionar um menu')),
    preview: (_, { locale }) => `/${locale}/catering`,
  },
  access: { read: publicRead, create: isStaff('manager'), update: isStaff('manager'), delete: isStaff('manager') },
  hooks: { afterChange: [revalidateTagHook('catering')], afterDelete: [revalidateTagHook('catering')] },
  defaultSort: 'order',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', localized: true, required: true, label: l('Nom du menu', 'Menu name', 'Name des Menüs', 'Nome do menu'), admin: { width: '50%' } },
        {
          name: 'tagline',
          type: 'text',
          localized: true,
          label: l('Phrase d’accroche', 'Short line', 'Kurzer Satz', 'Frase curta'),
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'pricePerGuestCents',
          type: 'number',
          required: true,
          min: 0,
          label: l('Prix par personne', 'Price per guest', 'Preis pro Person', 'Preço por pessoa'),
          admin: { width: '33%', components: scaledNumber('€') },
        },
        {
          name: 'minGuests',
          type: 'number',
          required: true,
          min: 1,
          defaultValue: 10,
          label: l('Minimum de personnes', 'Minimum guests', 'Mindestens Personen', 'Mínimo de pessoas'),
          admin: { width: '33%' },
        },
        {
          name: 'order',
          type: 'number',
          defaultValue: 0,
          label: l('Position', 'Position', 'Position', 'Posição'),
          admin: { width: '33%', description: l('1 = en premier', '1 = shown first', '1 = zuerst', '1 = primeiro') },
        },
      ],
    },
    {
      name: 'includes',
      type: 'array',
      localized: true,
      label: l('Ce qui est inclus', 'What is included', 'Was enthalten ist', 'O que está incluído'),
      labels: { singular: l('Ligne', 'Line', 'Zeile', 'Linha'), plural: l('Lignes', 'Lines', 'Zeilen', 'Linhas') },
      admin: { components: { RowLabel: '@/components/admin/row-label' } },
      fields: [{ name: 'item', type: 'text', required: true, label: l('Texte', 'Text', 'Text', 'Texto') }],
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: l('Photo', 'Photo', 'Foto', 'Foto') },
  ],
};

// Created only by the requestCatering service (server-computed estimate, gapless DEM number).
export const cateringRequests: CollectionConfig = {
  slug: 'cateringRequests',
  labels: {
    singular: l('Demande traiteur', 'Catering request', 'Catering-Anfrage', 'Pedido de catering'),
    plural: l('Demandes traiteur', 'Catering requests', 'Catering-Anfragen', 'Pedidos de catering'),
  },
  admin: {
    useAsTitle: 'number',
    defaultColumns: ['number', 'date', 'guests', 'status', 'createdAt'],
    hidden: hiddenUnless('sales'),
    description: l(
      'Les demandes envoyées depuis la page Traiteur. Changez le statut quand vous répondez.',
      'Requests sent from the Catering page. Change the status when you reply.',
      'Anfragen von der Catering-Seite. Ändern Sie den Status, wenn Sie antworten.',
      'Pedidos enviados a partir da página Catering. Mude o estado quando responder.',
    ),
  },
  access: { read: isStaff('sales'), create: none, update: isStaff('sales'), delete: isStaff('admin') },
  defaultSort: '-createdAt',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'number', type: 'text', required: true, unique: true, index: true, label: l('Numéro', 'Number', 'Nummer', 'Número'), admin: { readOnly: true, width: '50%' } },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'new',
          index: true,
          label: l('Statut', 'Status', 'Status', 'Estado'),
          options: REQUEST_STATUS,
          admin: { width: '50%', isClearable: false },
        },
      ],
    },
    { name: 'package', type: 'relationship', relationTo: 'cateringPackages', required: true, label: l('Menu', 'Menu', 'Menü', 'Menu') },
    {
      type: 'row',
      fields: [
        { name: 'guests', type: 'number', required: true, min: 1, label: l('Personnes', 'Guests', 'Personen', 'Pessoas'), admin: { width: '33%' } },
        {
          name: 'date',
          type: 'date',
          required: true,
          label: l('Date', 'Date', 'Datum', 'Data'),
          admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
        },
        { name: 'time', type: 'text', required: true, label: l('Heure', 'Time', 'Uhrzeit', 'Hora'), admin: { width: '33%' } },
      ],
    },
    { name: 'location', type: 'text', required: true, label: l('Lieu', 'Place', 'Ort', 'Local') },
    {
      name: 'contact',
      type: 'group',
      label: l('Client', 'Customer', 'Kunde', 'Cliente'),
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '33%' } },
            { name: 'email', type: 'email', required: true, label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail'), admin: { width: '33%' } },
            { name: 'phone', type: 'text', required: true, label: l('Téléphone', 'Phone', 'Telefon', 'Telefone'), admin: { width: '33%' } },
          ],
        },
      ],
    },
    { name: 'notes', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente') },
    {
      type: 'row',
      fields: [
        {
          name: 'estimateCents',
          type: 'number',
          required: true,
          label: l('Estimation', 'Estimate', 'Schätzung', 'Estimativa'),
          admin: {
            readOnly: true,
            width: '50%',
            description: l('Prix par personne × personnes', 'Price per guest × guests', 'Preis pro Person × Personen', 'Preço por pessoa × pessoas'),
            components: scaledNumber('€'),
          },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          label: l('Langue du client', 'Customer’s language', 'Sprache des Kunden', 'Língua do cliente'),
          options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
          admin: { readOnly: true, width: '50%' },
        },
      ],
    },
    // GG-046: who changed the status, the estimate or the details, and when.
    { name: 'trail', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/components/admin/audit-trail' } } },
  ],
};
