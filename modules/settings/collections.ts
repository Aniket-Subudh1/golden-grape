import { APIError, type CollectionConfig, type FieldAccess } from 'payload';
import { hasRole, hiddenUnless, isStaff, none, ROLES } from '@/lib/access';
import { addButton, l } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';

const adminOnly: FieldAccess = ({ req }) => hasRole(req.user, ['admin']);

// What each role may do, in everyday words (the values stay the role codes of lib/access.ts).
const ROLE_LABELS: Record<(typeof ROLES)[number], ReturnType<typeof l>> = {
  admin: l('Propriétaire : tout', 'Owner: everything', 'Inhaber: alles', 'Proprietário: tudo'),
  manager: l('Gérant : site et réglages', 'Manager: website and settings', 'Leitung: Website und Einstellungen', 'Gerente: site e definições'),
  sales: l('Ventes : demandes traiteur', 'Sales: catering requests', 'Verkauf: Catering-Anfragen', 'Vendas: pedidos de catering'),
  stock: l('Stock : boutique (bientôt)', 'Stock: shop (coming soon)', 'Lager: Shop (demnächst)', 'Stock: loja (em breve)'),
  attendance: l('Pointage (bientôt)', 'Time clock (coming soon)', 'Zeiterfassung (demnächst)', 'Ponto (em breve)'),
};

const users: CollectionConfig = {
  slug: 'users',
  labels: { singular: l('Membre de l’équipe', 'Team member', 'Teammitglied', 'Membro da equipa'), plural: l('Équipe', 'Team', 'Team', 'Equipa') },
  auth: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'roles', 'active'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les personnes qui peuvent se connecter ici, et ce que chacune peut faire.',
      'The people who can sign in here, and what each one may do.',
      'Die Personen, die sich hier anmelden können, und was jede darf.',
      'As pessoas que podem entrar aqui e o que cada uma pode fazer.',
    ),
    components: {
      ...addButton('users', l('Ajouter une personne', 'Add a person', 'Person hinzufügen', 'Adicionar uma pessoa')),
      edit: { SaveButton: '@/components/admin/save-button' },
    },
  },
  access: {
    // Every staff member reads and edits their own profile; admin/manager read everyone; only admin manages accounts.
    read: ({ req: { user } }) => (hasRole(user, ['manager']) ? true : user?.collection === 'users' ? { id: { equals: user.id } } : false),
    create: isStaff('admin'),
    update: ({ req: { user } }) => (hasRole(user, ['admin']) ? true : user?.collection === 'users' ? { id: { equals: user.id } } : false),
    delete: isStaff('admin'),
    unlock: isStaff('admin'),
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if (user.active === false) throw new APIError('This account is disabled.', 401, null, true);
        return user;
      },
    ],
    beforeChange: [
      ({ data, originalDoc, req, operation }) => {
        const removesOwnAdmin =
          operation === 'update' &&
          req.user?.id === originalDoc?.id &&
          originalDoc?.roles?.includes('admin') &&
          Array.isArray(data.roles) &&
          !data.roles.includes('admin');
        if (removesOwnAdmin) throw new APIError('You cannot remove your own admin role.', 400, null, true);
        return data;
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome') },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      saveToJWT: true,
      label: l('Peut gérer', 'May manage', 'Darf verwalten', 'Pode gerir'),
      options: ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
      access: { create: adminOnly, update: adminOnly },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: true,
          label: l('Peut se connecter', 'May sign in', 'Darf sich anmelden', 'Pode entrar'),
          access: { create: adminOnly, update: adminOnly },
          admin: { width: '50%' },
        },
        {
          name: 'locale',
          type: 'select',
          options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
          defaultValue: 'fr',
          required: true,
          label: l('Langue des e-mails', 'Language of e-mails', 'Sprache der E-Mails', 'Língua dos e-mails'),
          admin: { width: '50%', isClearable: false },
        },
      ],
    },
  ],
};

const auditLogs: CollectionConfig = {
  slug: 'auditLogs',
  labels: { singular: l('Action', 'Action', 'Aktion', 'Ação'), plural: l('Historique', 'Activity history', 'Verlauf', 'Histórico') },
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['createdAt', 'user', 'action', 'targetCollection'],
    hidden: hiddenUnless('admin'),
    description: l(
      'Qui a changé quoi et quand. Lecture seule.',
      'Who changed what, and when. Read only.',
      'Wer was wann geändert hat. Nur lesen.',
      'Quem mudou o quê e quando. Só leitura.',
    ),
  },
  access: { read: isStaff('admin'), create: none, update: none, delete: none },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', label: l('Personne', 'Person', 'Person', 'Pessoa') },
    { name: 'action', type: 'text', required: true, index: true, label: l('Action', 'Action', 'Aktion', 'Ação') },
    { name: 'targetCollection', type: 'text', required: true, label: l('Où', 'Where', 'Wo', 'Onde') },
    { name: 'docId', type: 'text', required: true, index: true, admin: { hidden: true } },
    { name: 'before', type: 'json', label: l('Avant', 'Before', 'Vorher', 'Antes') },
    { name: 'after', type: 'json', label: l('Après', 'After', 'Nachher', 'Depois') },
  ],
};

// Written only by lib/rate-limit.ts with a raw atomic upsert.
const rateLimits: CollectionConfig = {
  slug: 'rateLimits',
  dbName: 'rateLimits',
  admin: { hidden: true },
  access: { read: none, create: none, update: none, delete: none },
  custom: { ttl: { field: 'expiresAt', seconds: 0 } },
  timestamps: false,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'count', type: 'number', required: true },
    { name: 'expiresAt', type: 'date', required: true },
  ],
};

// Written only by lib/numbering.ts (nextNumber), inside the transaction that inserts the numbered document.
const counters: CollectionConfig = {
  slug: 'counters',
  admin: { hidden: true },
  access: { read: none, create: none, update: none, delete: none },
  indexes: [{ fields: ['series', 'year'], unique: true }],
  timestamps: false,
  fields: [
    { name: 'series', type: 'text', required: true },
    { name: 'year', type: 'number', required: true },
    { name: 'last', type: 'number', required: true },
  ],
};

export const settingsCollections: CollectionConfig[] = [users, auditLogs, rateLimits, counters];
