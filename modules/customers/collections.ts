import type { CollectionConfig, FieldAccess } from 'payload';
import { hiddenUnless, isStaff, staffOrSelf } from '@/lib/access';
import { addButton, badgeCell, emptyList, l } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';

// Shop accounts (04 §3). A separate auth collection from staff `users`; the website keeps its session in its own
// cookie (service.ts), so a customer signing in never touches a staff session. Customers are created by the sign-up
// action (rate-limited) or by staff; the API does not let anyone else create one.

const staffOnly: FieldAccess = ({ req }) => req.user?.collection === 'users';

export const customerGroups: CollectionConfig = {
  slug: 'customerGroups',
  labels: { singular: l('Groupe de clients', 'Customer group', 'Kundengruppe', 'Grupo de clientes'), plural: l('Groupes de clients', 'Customer groups', 'Kundengruppen', 'Grupos de clientes') },
  admin: {
    useAsTitle: 'name',
    hidden: hiddenUnless('sales'),
    description: l(
      'Par exemple « Restaurants » ou « Entreprises ». Les prix par groupe arrivent avec les listes de prix.',
      'For example “Restaurants” or “Companies”. Group prices come with price lists.',
      'Zum Beispiel „Restaurants“ oder „Firmen“. Gruppenpreise kommen mit den Preislisten.',
      'Por exemplo «Restaurantes» ou «Empresas». Os preços por grupo chegam com as listas de preços.',
    ),
    components: addButton('customerGroups', l('Ajouter un groupe', 'Add a group', 'Gruppe hinzufügen', 'Adicionar um grupo')),
  },
  access: { read: isStaff(), create: isStaff('manager', 'sales'), update: isStaff('manager', 'sales'), delete: isStaff('manager') },
  fields: [{ name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome') }],
};

export const customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: l('Client', 'Customer', 'Kunde', 'Cliente'), plural: l('Clients', 'Customers', 'Kunden', 'Clientes') },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30,
    maxLoginAttempts: 10,
    lockTime: 15 * 60_000,
    // Loaded when sending: the mail module reaches payload.config.ts, which imports this file.
    forgotPassword: {
      generateEmailSubject: async (args) => (await (await import('./mail')).resetPasswordMail(args?.user, '')).subject,
      generateEmailHTML: async (args) => (await (await import('./mail')).resetPasswordMail(args?.user, args?.token ?? '')).html,
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'type', 'company', 'createdAt'],
    listSearchableFields: ['name', 'email', 'company'],
    hidden: hiddenUnless('sales'),
    description: l(
      'Les comptes créés sur le site (particuliers et entreprises).',
      'The accounts created on the website (private and business).',
      'Die auf der Website erstellten Konten (privat und geschäftlich).',
      'As contas criadas no site (particulares e empresas).',
    ),
    components: {
      ...addButton('customers', l('Ajouter un client', 'Add a customer', 'Kunde hinzufügen', 'Adicionar um cliente')),
      ...emptyList({
        icon: 'customers',
        title: l('Aucun client pour l’instant', 'No customers yet', 'Noch keine Kunden', 'Ainda sem clientes'),
        text: l(
          'Les comptes créés sur le site apparaîtront ici. Vous pouvez aussi créer un compte pour un client professionnel.',
          'Accounts created on the website appear here. You can also create one for a business customer.',
          'Auf der Website erstellte Konten erscheinen hier. Sie können auch eines für einen Geschäftskunden anlegen.',
          'As contas criadas no site aparecem aqui. Também pode criar uma para um cliente profissional.',
        ),
        action: l('Ajouter un client', 'Add a customer', 'Kunde hinzufügen', 'Adicionar um cliente'),
      }),
    },
  },
  access: {
    read: staffOrSelf('id'),
    update: staffOrSelf('id'),
    create: isStaff('sales'),
    delete: isStaff('admin'),
    unlock: isStaff('sales'),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
        { name: 'phone', type: 'text', label: l('Téléphone', 'Phone', 'Telefon', 'Telefone'), admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'private',
          label: l('Type', 'Type', 'Art', 'Tipo'),
          options: [
            { value: 'private', label: l('Particulier', 'Private', 'Privat', 'Particular') },
            { value: 'business', label: l('Entreprise', 'Business', 'Firma', 'Empresa') },
          ],
          admin: { width: '33%', isClearable: false, components: badgeCell({ private: 'neutral', business: 'info' }) },
        },
        { name: 'company', type: 'text', label: l('Société', 'Company', 'Firma', 'Empresa'), admin: { width: '33%', condition: (data) => data?.type === 'business' } },
        { name: 'vatNumber', type: 'text', label: l('N° de TVA', 'VAT number', 'USt-IdNr.', 'N.º de IVA'), admin: { width: '33%', condition: (data) => data?.type === 'business' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'locale',
          type: 'select',
          required: true,
          defaultValue: 'fr',
          label: l('Langue', 'Language', 'Sprache', 'Língua'),
          options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
          admin: { width: '50%', isClearable: false },
        },
        {
          name: 'marketingConsent',
          type: 'checkbox',
          defaultValue: false,
          label: l('Accepte les nouvelles par e-mail', 'Accepts news by e-mail', 'Akzeptiert Neuigkeiten per E-Mail', 'Aceita novidades por e-mail'),
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      label: l('Adresses', 'Addresses', 'Adressen', 'Moradas'),
      labels: { singular: l('Adresse', 'Address', 'Adresse', 'Morada'), plural: l('Adresses', 'Addresses', 'Adressen', 'Moradas') },
      admin: { components: { RowLabel: '@/components/admin/row-label' } },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', label: l('Nom de l’adresse', 'Address name', 'Name der Adresse', 'Nome da morada'), admin: { width: '50%', placeholder: 'Maison, Bureau…' } },
            { name: 'isDefault', type: 'checkbox', defaultValue: false, label: l('Par défaut', 'Default', 'Standard', 'Predefinida'), admin: { width: '50%' } },
          ],
        },
        { name: 'line1', type: 'text', required: true, label: l('Rue et numéro', 'Street and number', 'Straße und Hausnummer', 'Rua e número') },
        { name: 'line2', type: 'text', label: l('Complément', 'Address line 2', 'Adresszusatz', 'Complemento') },
        {
          type: 'row',
          fields: [
            { name: 'postalCode', type: 'text', required: true, label: l('Code postal', 'Postcode', 'Postleitzahl', 'Código postal'), admin: { width: '33%' } },
            { name: 'city', type: 'text', required: true, label: l('Ville', 'Town', 'Ort', 'Localidade'), admin: { width: '33%' } },
            { name: 'country', type: 'text', required: true, defaultValue: 'LU', label: l('Pays', 'Country', 'Land', 'País'), admin: { width: '33%' } },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: l('Conditions (équipe uniquement)', 'Terms (staff only)', 'Konditionen (nur Team)', 'Condições (só equipa)'),
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'group', type: 'relationship', relationTo: 'customerGroups', label: l('Groupe', 'Group', 'Gruppe', 'Grupo'), access: { create: staffOnly, update: staffOnly }, admin: { width: '33%' } },
            {
              name: 'paymentTerm',
              type: 'text',
              label: l('Conditions de paiement', 'Payment terms', 'Zahlungsbedingungen', 'Condições de pagamento'),
              access: { create: staffOnly, update: staffOnly },
              admin: { width: '33%' },
            },
            {
              name: 'loyaltyBalance',
              type: 'number',
              defaultValue: 0,
              label: l('Points fidélité', 'Loyalty points', 'Treuepunkte', 'Pontos de fidelidade'),
              access: { create: () => false, update: () => false },
              admin: { width: '33%', readOnly: true },
            },
          ],
        },
      ],
    },
  ],
};
