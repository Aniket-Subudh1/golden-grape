import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff, publicRead } from '@/lib/access';
import { revalidateTagHook } from '@/lib/revalidate';
import { validateHHmm, WEEKDAY_OPTIONS } from '@/lib/time';

const editable = { read: publicRead, update: isStaff('manager') };
const link: Field[] = [
  { name: 'label', type: 'text', localized: true, required: true },
  {
    name: 'href',
    type: 'text',
    admin: { description: 'Path without language, e.g. /maison. Leave empty to show plain text (page not online yet).' },
  },
];

export const header: GlobalConfig = {
  slug: 'Header',
  admin: { group: 'Content', hidden: hiddenUnless('manager') },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('header')] },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      admin: { description: 'The first three sit left of the logo on desktop, the rest on the right.' },
      fields: link,
    },
  ],
};

export const footer: GlobalConfig = {
  slug: 'Footer',
  admin: { group: 'Content', hidden: hiddenUnless('manager'), description: 'Published legal pages are linked automatically.' },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('footer')] },
  fields: [
    { name: 'tagline', type: 'textarea', localized: true },
    {
      name: 'columns',
      type: 'array',
      maxRows: 3,
      fields: [
        { name: 'title', type: 'text', localized: true, required: true },
        { name: 'links', type: 'array', fields: link },
      ],
    },
  ],
};

export const happyHour: GlobalConfig = {
  slug: 'HappyHour',
  admin: { group: 'Content', hidden: hiddenUnless('manager') },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('happy-hour')] },
  fields: [
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { description: 'Hides the home-page section when off.' } },
    { name: 'days', type: 'select', hasMany: true, required: true, options: WEEKDAY_OPTIONS },
    {
      type: 'row',
      fields: [
        { name: 'from', type: 'text', required: true, validate: validateHHmm },
        { name: 'to', type: 'text', required: true, validate: validateHHmm },
      ],
    },
    { name: 'titleA', type: 'text', localized: true, required: true },
    { name: 'titleB', type: 'text', localized: true, admin: { description: 'Shown in gold italics' } },
    { name: 'text', type: 'textarea', localized: true, admin: { description: 'Wrap words in <gold>…</gold> to colour them gold.' } },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
};

export const cmsGlobals: GlobalConfig[] = [header, footer, happyHour];
