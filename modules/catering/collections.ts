import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, none, publicRead } from '@/lib/access';
import { LOCALES } from '@/lib/i18n';
import { revalidateTagHook } from '@/lib/revalidate';

export const cateringPackages: CollectionConfig = {
  slug: 'cateringPackages',
  labels: { singular: 'Catering package', plural: 'Catering packages' },
  admin: { group: 'Content', useAsTitle: 'name', defaultColumns: ['name', 'pricePerGuestCents', 'minGuests', 'order'], hidden: hiddenUnless('manager') },
  access: { read: publicRead, create: isStaff('manager'), update: isStaff('manager'), delete: isStaff('manager') },
  hooks: { afterChange: [revalidateTagHook('catering')], afterDelete: [revalidateTagHook('catering')] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    { name: 'tagline', type: 'text', localized: true },
    { name: 'includes', type: 'array', localized: true, fields: [{ name: 'item', type: 'text', required: true }] },
    {
      type: 'row',
      fields: [
        { name: 'pricePerGuestCents', type: 'number', required: true, min: 0, admin: { description: 'In cents: 5500 = 55 €' } },
        { name: 'minGuests', type: 'number', required: true, min: 1, defaultValue: 10 },
        { name: 'order', type: 'number', defaultValue: 0 },
      ],
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
};

// Created only by the requestCatering service (server-computed estimate, gapless REQ number).
export const cateringRequests: CollectionConfig = {
  slug: 'cateringRequests',
  labels: { singular: 'Catering request', plural: 'Catering requests' },
  admin: { group: 'Sales', useAsTitle: 'number', defaultColumns: ['number', 'date', 'guests', 'status', 'createdAt'], hidden: hiddenUnless('sales') },
  access: { read: isStaff('sales'), create: none, update: isStaff('sales'), delete: isStaff('admin') },
  defaultSort: '-createdAt',
  fields: [
    { name: 'number', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: ['new', 'quoted', 'accepted', 'declined'],
      admin: { position: 'sidebar' },
    },
    { name: 'package', type: 'relationship', relationTo: 'cateringPackages', required: true },
    {
      type: 'row',
      fields: [
        { name: 'guests', type: 'number', required: true, min: 1 },
        { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } } },
        { name: 'time', type: 'text', required: true },
      ],
    },
    { name: 'location', type: 'text', required: true },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text', required: true },
      ],
    },
    { name: 'notes', type: 'textarea' },
    { name: 'estimateCents', type: 'number', required: true, admin: { readOnly: true, description: 'Price per guest × guests, computed on the server.' } },
    { name: 'locale', type: 'select', options: [...LOCALES], required: true, admin: { position: 'sidebar' } },
  ],
};
