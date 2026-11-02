import type { Block, Field } from 'payload';

// The CMS blocks of 05 §4. Text fields are localized one by one, so the block structure is shared by
// the four languages and an edit in EN never changes FR.
const text = (name: string, required = false): Field => ({ name, type: 'text', localized: true, required });
const image = (required = false): Field => ({ name: 'image', type: 'upload', relationTo: 'media', required });
const heading = (required = true): Field[] => [
  text('eyebrow'),
  text('titleA', required),
  { name: 'titleB', type: 'text', localized: true, admin: { description: 'Shown in gold italics' } },
];

export const hero: Block = {
  slug: 'hero',
  fields: [...heading(), { name: 'subtitle', type: 'textarea', localized: true }, image()],
};

export const richText: Block = {
  slug: 'richText',
  fields: [{ name: 'body', type: 'richText', localized: true, required: true }],
};

export const mediaText: Block = {
  slug: 'mediaText',
  fields: [
    image(true),
    { name: 'imagePosition', type: 'select', options: ['left', 'right'], defaultValue: 'left', required: true },
    ...heading(),
    { name: 'body', type: 'richText', localized: true },
  ],
};

export const cardGrid: Block = {
  slug: 'cardGrid',
  fields: [
    ...heading(false),
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'cards',
      options: [
        { label: 'Hairline grid (text only)', value: 'hairline' },
        { label: 'Image cards', value: 'cards' },
        { label: 'Dark band', value: 'dark' },
      ],
    },
    {
      name: 'cards',
      type: 'array',
      minRows: 1,
      fields: [image(), text('eyebrow'), text('title', true), { name: 'text', type: 'textarea', localized: true }],
    },
  ],
};

export const cta: Block = {
  slug: 'cta',
  fields: [
    ...heading(),
    { name: 'subtitle', type: 'textarea', localized: true },
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
      fields: [
        text('label', true),
        { name: 'href', type: 'text', required: true, admin: { description: 'Path without language, e.g. /contact' } },
        { name: 'style', type: 'select', options: ['solid', 'outline'], defaultValue: 'solid', required: true },
      ],
    },
  ],
};
