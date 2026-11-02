import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { revalidateTagHook } from '@/lib/revalidate';
import { validateHHmm, WEEKDAY_OPTIONS } from '@/lib/time';

export const MODULES = ['b2b', 'purchasing', 'promotions', 'loyalty', 'giftCards', 'reviews', 'attendance', 'pos'] as const;
export type ModuleName = (typeof MODULES)[number];

const time = (name: string): Field => ({ name, type: 'text', required: true, validate: validateHHmm, admin: { width: '33%' } });
const text = (name: string, required = false): Field => ({ name, type: 'text', required, admin: { width: '50%' } });
const def = (name: string, defaultValue: string): Field => ({ name, type: 'text', defaultValue, admin: { width: '50%' } });
const row = (...fields: Field[]): Field => ({ type: 'row', fields });

export const businessSettings: GlobalConfig = {
  slug: 'BusinessSettings',
  label: 'Business settings',
  admin: { group: 'Settings', hidden: hiddenUnless('manager') },
  // Public pages read it only through getSettings(), which strips bank and internal fields.
  access: { read: isStaff('manager'), update: isStaff('manager') },
  hooks: { afterChange: [revalidateTagHook('settings')] },
  fields: [
    {
      // Unnamed tabs only group the form; the stored data keeps its shape.
      type: 'tabs',
      tabs: [
        {
          label: 'Business',
          fields: [
            {
              name: 'business',
              type: 'group',
              label: false,
              fields: [
                row(text('name', true), text('legalName')),
                row(text('street', true), text('postalCode', true)),
                row(text('city', true), { name: 'country', type: 'text', defaultValue: 'Luxembourg', admin: { width: '50%' } }),
                row(text('phone'), { name: 'email', type: 'email', admin: { width: '50%' } }),
                row(text('vatNumber'), { name: 'rcs', type: 'text', label: 'RCS', admin: { width: '50%' } }),
                row({ name: 'iban', type: 'text', label: 'IBAN', admin: { width: '50%' } }, { name: 'bic', type: 'text', label: 'BIC', admin: { width: '50%' } }),
                { name: 'mapsUrl', type: 'text', label: 'Google Maps link' },
                row({ name: 'instagram', type: 'text', label: 'Instagram URL', admin: { width: '50%' } }, { name: 'facebook', type: 'text', label: 'Facebook URL', admin: { width: '50%' } }),
              ],
            },
          ],
        },
        {
          label: 'Opening hours',
          fields: [
            {
              name: 'hours',
              type: 'array',
              labels: { singular: 'Opening slot', plural: 'Opening hours' },
              admin: { description: 'One row per open day (a day may have two rows). Days without a row are closed.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'day', type: 'select', required: true, options: WEEKDAY_OPTIONS, admin: { width: '33%' } },
                    time('open'),
                    time('close'),
                  ],
                },
              ],
            },
            { name: 'closedDates', type: 'array', label: 'Closed dates', fields: [{ name: 'date', type: 'date', required: true }] },
          ],
        },
        {
          label: 'VAT & numbering',
          fields: [
            {
              name: 'vat',
              type: 'array',
              label: 'VAT rates',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'select', required: true, options: ['standard', 'intermediate', 'reduced', 'superReduced'], admin: { width: '50%' } },
                    { name: 'rateBp', type: 'number', required: true, min: 0, admin: { width: '50%', description: 'Basis points: 1700 = 17 %' } },
                  ],
                },
              ],
            },
            {
              name: 'numbering',
              type: 'group',
              admin: { description: '{YYYY} = year, {0000} = zero-padded number.' },
              fields: [
                row(def('invoice', 'INV-{YYYY}-{00000}'), def('creditNote', 'CN-{YYYY}-{00000}')),
                row(def('quotation', 'QUO-{YYYY}-{00000}'), def('deliveryNote', 'DN-{YYYY}-{00000}')),
                row(def('order', 'ORD-{YYYY}-{00000}'), def('cateringRequest', 'REQ-{YYYY}-{0000}')),
              ],
            },
          ],
        },
        {
          label: 'Alerts & modules',
          fields: [
            {
              name: 'alerts',
              type: 'group',
              fields: [
                row(
                  { name: 'defaultLowStock', type: 'number', defaultValue: 3, min: 0, admin: { width: '33%' } },
                  { name: 'lowStockEmail', type: 'email', admin: { width: '33%' } },
                  { name: 'outboxAlertEmail', type: 'email', admin: { width: '33%' } },
                ),
              ],
            },
            {
              name: 'modules',
              type: 'group',
              admin: { description: 'Optional modules. Core modules cannot be switched off.' },
              fields: [row(...MODULES.map((name): Field => ({ name, type: 'checkbox', defaultValue: false, admin: { width: '25%' } })))],
            },
          ],
        },
        {
          label: 'Payment terms',
          fields: [
            {
              name: 'paymentTerms',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'text', required: true, admin: { width: '33%' } },
                    { name: 'days', type: 'number', required: true, min: 0, admin: { width: '33%' } },
                    { name: 'label', type: 'text', required: true, localized: true, admin: { width: '33%' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
