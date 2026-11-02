import type { CollectionConfig } from 'payload';
import { isStaff, none, ROLES } from '@/lib/access';

const users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      saveToJWT: true,
      defaultValue: ['admin'],
      options: [...ROLES],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
};

const auditLogs: CollectionConfig = {
  slug: 'auditLogs',
  admin: { useAsTitle: 'action', defaultColumns: ['action', 'collection', 'docId', 'user', 'createdAt'] },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'collection', type: 'text', required: true },
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

export const settingsCollections: CollectionConfig[] = [users, auditLogs, rateLimits];
