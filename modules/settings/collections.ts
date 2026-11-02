import type { CollectionConfig } from 'payload';

export const ROLES = ['admin', 'manager', 'sales', 'stock', 'attendance'] as const;

const users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
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

export const settingsCollections: CollectionConfig[] = [users];
