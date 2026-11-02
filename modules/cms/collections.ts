import path from 'node:path';
import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, published, publicRead } from '@/lib/access';
import { revalidateTagHook } from '@/lib/revalidate';
import { cardGrid, cta, hero, mediaText, richText } from './blocks';

const editors = isStaff('manager');

const slugField = { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar' } } as const;

export const media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content', hidden: hiddenUnless('manager') },
  access: { read: publicRead, create: editors, update: editors, delete: editors },
  upload: {
    // Local fallback when S3 is not configured; with S3 the storage plugin takes over.
    staticDir: path.resolve(process.cwd(), 'media'),
    mimeTypes: ['image/*'],
    focalPoint: true,
    imageSizes: [
      { name: 'thumb', width: 400, formatOptions: { format: 'webp' } },
      { name: 'card', width: 800, formatOptions: { format: 'webp' } },
      { name: 'hero', width: 1920, formatOptions: { format: 'webp' } },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', localized: true, required: true, admin: { description: 'Describes the image (accessibility, SEO).' } },
    { name: 'caption', type: 'text', localized: true },
  ],
};

export const pages: CollectionConfig = {
  slug: 'pages',
  admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'], hidden: hiddenUnless('manager') },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('pages')], afterDelete: [revalidateTagHook('pages')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    slugField,
    { name: 'layout', type: 'blocks', blocks: [hero, richText, mediaText, cardGrid, cta] },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
        { name: 'image', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
};

export const legal: CollectionConfig = {
  slug: 'legal',
  labels: { singular: 'Legal page', plural: 'Legal pages' },
  admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'], hidden: hiddenUnless('manager') },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('legal')], afterDelete: [revalidateTagHook('legal')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    slugField,
    { name: 'body', type: 'richText', localized: true, required: true },
  ],
};

export const cmsCollections: CollectionConfig[] = [media, pages, legal];
