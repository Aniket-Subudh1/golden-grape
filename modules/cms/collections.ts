import path from 'node:path';
import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, published, publicRead } from '@/lib/access';
import { autoSlug, createInDrawer, l, seoSection } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';
import { cardGrid, cta, hero, mediaText, richText } from './blocks';

const editors = isStaff('manager');

export const media: CollectionConfig = {
  slug: 'media',
  labels: { singular: l('Photo', 'Photo', 'Foto', 'Foto'), plural: l('Photos', 'Photos', 'Fotos', 'Fotos') },
  admin: {
    hidden: hiddenUnless('manager'),
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    description: l(
      'Toutes les photos du site. Ajoutez-en ici ou directement depuis un événement.',
      'All the photos of the website. Add them here or straight from an event.',
      'Alle Fotos der Website. Hier hinzufügen oder direkt in einer Veranstaltung.',
      'Todas as fotos do site. Adicione-as aqui ou diretamente num evento.',
    ),
    components: createInDrawer('media', l('Ajouter des photos', 'Upload photos', 'Fotos hochladen', 'Carregar fotos')),
  },
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
    {
      name: 'alt',
      type: 'text',
      localized: true,
      required: true,
      label: l('Ce que montre la photo', 'What the photo shows', 'Was das Foto zeigt', 'O que a foto mostra'),
      admin: {
        description: l(
          'Lu à voix haute aux personnes aveugles et utilisé par Google. Ex. : « Table dressée dans la cave ».',
          'Read aloud to blind visitors and used by Google. E.g. “Table set in the wine cellar”.',
          'Wird blinden Besuchern vorgelesen und von Google genutzt. Z. B. „Gedeckter Tisch im Weinkeller“.',
          'Lido em voz alta a pessoas cegas e usado pelo Google. Ex.: «Mesa posta na cave».',
        ),
      },
    },
    { name: 'caption', type: 'text', localized: true, label: l('Légende (facultatif)', 'Caption (optional)', 'Bildunterschrift (optional)', 'Legenda (opcional)') },
  ],
};

export const pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: l('Page La Maison', 'The House page', 'Seite „Das Haus“', 'Página A Casa'),
    plural: l('Page La Maison', 'The House page', 'Seite „Das Haus“', 'Página A Casa'),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Le contenu de la page « La Maison », bloc par bloc.',
      'The content of “The House” page, block by block.',
      'Der Inhalt der Seite „Das Haus“, Block für Block.',
      'O conteúdo da página «A Casa», bloco a bloco.',
    ),
    preview: (doc, { locale }) => (doc.slug ? `/${locale}/${doc.slug}` : null),
  },
  versions: { drafts: true },
  // The site shows only the `maison` page, so only the owner adds or removes pages (a new one would appear nowhere).
  access: { read: published, create: isStaff('admin'), update: editors, delete: isStaff('admin') },
  hooks: { afterChange: [revalidateTagHook('pages')], afterDelete: [revalidateTagHook('pages')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: l('Titre de la page', 'Page title', 'Seitentitel', 'Título da página') },
    autoSlug('pages'),
    {
      name: 'layout',
      type: 'blocks',
      label: l('Blocs de la page', 'Page blocks', 'Seitenblöcke', 'Blocos da página'),
      labels: { singular: l('Bloc', 'Block', 'Block', 'Bloco'), plural: l('Blocs', 'Blocks', 'Blöcke', 'Blocos') },
      blocks: [hero, richText, mediaText, cardGrid, cta],
    },
    seoSection([
      { name: 'title', type: 'text', localized: true, label: l('Titre dans Google', 'Title in Google', 'Titel bei Google', 'Título no Google') },
      { name: 'description', type: 'textarea', localized: true, label: l('Texte dans Google', 'Text in Google', 'Text bei Google', 'Texto no Google') },
      { name: 'image', type: 'upload', relationTo: 'media', label: l('Image de partage', 'Sharing image', 'Bild beim Teilen', 'Imagem de partilha') },
    ]),
  ],
};

export const legal: CollectionConfig = {
  slug: 'legal',
  labels: {
    singular: l('Page légale', 'Legal page', 'Rechtliche Seite', 'Página legal'),
    plural: l('Pages légales', 'Legal pages', 'Rechtliche Seiten', 'Páginas legais'),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Mentions légales, confidentialité, conditions. Une page en ligne apparaît dans le pied de page.',
      'Legal notice, privacy, terms. A page that is online appears in the footer.',
      'Impressum, Datenschutz, AGB. Eine Seite, die online ist, erscheint in der Fußzeile.',
      'Aviso legal, privacidade, condições. Uma página online aparece no rodapé.',
    ),
    components: createInDrawer('legal', l('Ajouter une page légale', 'Add a legal page', 'Rechtliche Seite hinzufügen', 'Adicionar uma página legal')),
    preview: (doc, { locale }) => (doc.slug ? `/${locale}/legal/${doc.slug}` : null),
  },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('legal')], afterDelete: [revalidateTagHook('legal')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: l('Titre', 'Title', 'Titel', 'Título') },
    autoSlug('legal'),
    { name: 'body', type: 'richText', localized: true, required: true, label: l('Texte', 'Text', 'Text', 'Texto') },
  ],
};

export const cmsCollections: CollectionConfig[] = [media, pages, legal];
