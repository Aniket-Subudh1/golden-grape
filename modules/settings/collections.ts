import { APIError, type CollectionConfig, type FieldAccess } from 'payload';
import { hasRole, hiddenUnless, isStaff, none, ROLES } from '@/lib/access';
import { LOCALES } from '@/lib/i18n';

const adminOnly: FieldAccess = ({ req }) => hasRole(req.user, ['admin']);

const users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'name', group: 'People', defaultColumns: ['name', 'email', 'roles', 'active'], hidden: hiddenUnless('manager') },
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
    { name: 'name', type: 'text', required: true },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      saveToJWT: true,
      options: [...ROLES],
      access: { create: adminOnly, update: adminOnly },
    },
    { name: 'active', type: 'checkbox', defaultValue: true, access: { create: adminOnly, update: adminOnly } },
    { name: 'locale', type: 'select', options: [...LOCALES], defaultValue: 'fr', required: true },
  ],
};

const auditLogs: CollectionConfig = {
  slug: 'auditLogs',
  admin: {
    useAsTitle: 'action',
    group: 'Settings',
    defaultColumns: ['action', 'targetCollection', 'docId', 'user', 'createdAt'],
    hidden: hiddenUnless('manager'),
  },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'targetCollection', type: 'text', required: true },
    { name: 'docId', type: 'text', required: true, index: true },
    { name: 'before', type: 'json' },
    { name: 'after', type: 'json' },
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
