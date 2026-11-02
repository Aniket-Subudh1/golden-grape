import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff, publicRead } from '@/lib/access';
import { revalidateTagHook } from '@/lib/revalidate';
import { validateHHmm, WEEKDAY_OPTIONS } from '@/lib/time';

const editable = { read: publicRead, update: isStaff('manager') };
// One compact row per link (label | path), titled by its label; the path help is given once, on the list.
const rowLabel = { components: { RowLabel: '@/components/admin/row-label' } };
const pathHelp = 'Path without language, e.g. /maison. Leave the path empty to show plain text (page not online yet).';
const link: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'label', type: 'text', localized: true, required: true, admin: { width: '50%' } },
      { name: 'href', label: 'Path', type: 'text', admin: { width: '50%' } },
    ],
  },
];

export const header: GlobalConfig = {
  slug: 'Header',
  admin: { group: 'Content', hidden: hiddenUnless('manager'), description: 'The menu at the top of every page.' },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('header')] },
  fields: [
    {
      name: 'navItems',
      label: 'Menu links',
      labels: { singular: 'Link', plural: 'Links' },
      type: 'array',
      maxRows: 8,
      admin: { description: `The first three sit left of the logo on desktop, the rest on the right. ${pathHelp}`, ...rowLabel },
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
      labels: { singular: 'Column', plural: 'Columns' },
      type: 'array',
      maxRows: 3,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        { name: 'title', type: 'text', localized: true, required: true },
        {
          name: 'links',
          labels: { singular: 'Link', plural: 'Links' },
          type: 'array',
          admin: { description: pathHelp, ...rowLabel },
          fields: link,
        },
      ],
    },
  ],
};

export const happyHour: GlobalConfig = {
  slug: 'HappyHour',
  admin: { group: 'Content', hidden: hiddenUnless('manager'), description: 'The Happy Hour section of the home page.' },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('happy-hour')] },
  fields: [
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { description: 'Hides the home-page section when off.' } },
    { name: 'days', type: 'select', hasMany: true, required: true, options: WEEKDAY_OPTIONS },
    {
      type: 'row',
      fields: [
        { name: 'from', type: 'text', required: true, validate: validateHHmm, admin: { width: '50%' } },
        { name: 'to', type: 'text', required: true, validate: validateHHmm, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'titleA', type: 'text', localized: true, required: true, admin: { width: '50%' } },
        { name: 'titleB', type: 'text', localized: true, admin: { width: '50%', description: 'Shown in gold italics' } },
      ],
    },
    { name: 'text', type: 'textarea', localized: true, admin: { description: 'Wrap words in <gold>…</gold> to colour them gold.' } },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
};

export const cmsGlobals: GlobalConfig[] = [header, footer, happyHour];
