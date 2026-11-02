import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, published } from '@/lib/access';
import { createInDrawer } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';

const editors = isStaff('manager');

// Content only in M1.3; bookings (eventBookings, the `booked` counter) arrive in M2.3.
export const events: CollectionConfig = {
  slug: 'events',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'priceCents', '_status'],
    hidden: hiddenUnless('manager'),
    components: createInDrawer('events', 'New event'),
  },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('events')], afterDelete: [revalidateTagHook('events')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar' } },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } } },
        { name: 'endsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } } },
      ],
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'description', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'priceCents', type: 'number', required: true, min: 0, defaultValue: 0, admin: { description: 'Per person, in cents: 4500 = 45 €. 0 = free.' } },
        { name: 'capacity', type: 'number', min: 1 },
        { name: 'booked', type: 'number', defaultValue: 0, access: { create: () => false, update: () => false }, admin: { readOnly: true } },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
  ],
};
