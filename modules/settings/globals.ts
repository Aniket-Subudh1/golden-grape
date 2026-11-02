import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { revalidateTagHook } from '@/lib/revalidate';

export const MODULES = ['b2b', 'purchasing', 'promotions', 'loyalty', 'giftCards', 'reviews', 'attendance', 'pos'] as const;
export type ModuleName = (typeof MODULES)[number];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (value: unknown) => (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || 'Use HH:mm, e.g. 09:30';
const time = (name: string): Field => ({ name, type: 'text', required: true, validate: hhmm, admin: { width: '33%' } });

export const businessSettings: GlobalConfig = {
  slug: 'BusinessSettings',
  label: 'Business settings',
  admin: { group: 'Settings', hidden: hiddenUnless('manager') },
  // Public pages read it only through getSettings(), which strips bank and internal fields.
  access: { read: isStaff('manager'), update: isStaff('manager') },
  hooks: { afterChange: [revalidateTagHook('settings')] },
  fields: [
    {
      name: 'business',
      type: 'group',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'legalName', type: 'text' },
        { name: 'street', type: 'text', required: true },
        { name: 'postalCode', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'country', type: 'text', defaultValue: 'Luxembourg' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'vatNumber', type: 'text' },
        { name: 'rcs', type: 'text', label: 'RCS' },
        { name: 'iban', type: 'text', label: 'IBAN' },
        { name: 'bic', type: 'text', label: 'BIC' },
        { name: 'mapsUrl', type: 'text', label: 'Google Maps link' },
        { name: 'instagram', type: 'text', label: 'Instagram URL' },
        { name: 'facebook', type: 'text', label: 'Facebook URL' },
      ],
    },
    {
      name: 'hours',
      type: 'array',
      labels: { singular: 'Opening slot', plural: 'Opening hours' },
      admin: { description: 'One row per open day (a day may have two rows). Days without a row are closed.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'day', type: 'select', required: true, options: DAYS.map((label, i) => ({ label, value: String(i) })), admin: { width: '33%' } },
            time('open'),
            time('close'),
          ],
        },
      ],
    },
    { name: 'closedDates', type: 'array', fields: [{ name: 'date', type: 'date', required: true }] },
    {
      name: 'vat',
      type: 'array',
      label: 'VAT rates',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'key', type: 'select', required: true, options: ['standard', 'intermediate', 'reduced', 'superReduced'] },
            { name: 'rateBp', type: 'number', required: true, min: 0, admin: { description: 'Basis points: 1700 = 17 %' } },
          ],
        },
      ],
    },
    {
      name: 'numbering',
      type: 'group',
      admin: { description: '{YYYY} = year, {0000} = zero-padded number.' },
      fields: [
        { name: 'invoice', type: 'text', defaultValue: 'INV-{YYYY}-{00000}' },
        { name: 'creditNote', type: 'text', defaultValue: 'CN-{YYYY}-{00000}' },
        { name: 'quotation', type: 'text', defaultValue: 'QUO-{YYYY}-{00000}' },
        { name: 'deliveryNote', type: 'text', defaultValue: 'DN-{YYYY}-{00000}' },
        { name: 'order', type: 'text', defaultValue: 'ORD-{YYYY}-{00000}' },
        { name: 'cateringRequest', type: 'text', defaultValue: 'REQ-{YYYY}-{0000}' },
      ],
    },
    {
      name: 'alerts',
      type: 'group',
      fields: [
        { name: 'defaultLowStock', type: 'number', defaultValue: 3, min: 0 },
        { name: 'lowStockEmail', type: 'email' },
        { name: 'outboxAlertEmail', type: 'email' },
      ],
    },
    {
      name: 'modules',
      type: 'group',
      admin: { description: 'Optional modules. Core modules cannot be switched off.' },
      fields: MODULES.map((name) => ({ name, type: 'checkbox', defaultValue: false })),
    },
    {
      name: 'paymentTerms',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'key', type: 'text', required: true },
            { name: 'days', type: 'number', required: true, min: 0 },
            { name: 'label', type: 'text', required: true, localized: true },
          ],
        },
      ],
    },
  ],
};
