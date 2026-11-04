import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { de } from '@payloadcms/translations/languages/de';
import { en } from '@payloadcms/translations/languages/en';
import { fr } from '@payloadcms/translations/languages/fr';
import { pt } from '@payloadcms/translations/languages/pt';
import { s3Storage } from '@payloadcms/storage-s3';
import type { CreateIndexesOptions, IndexSpecification } from 'mongodb';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { env, isBuildPhase, s3Configured, smtpConfigured } from '@/lib/env';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { cmsCollections } from '@/modules/cms/collections';
import { cmsGlobals } from '@/modules/cms/globals';
import { catalogueCollections } from '@/modules/catalogue/collections';
import { cateringPackages, cateringRequests } from '@/modules/catering/collections';
import { events } from '@/modules/events/collections';
import { inventoryCollections } from '@/modules/inventory/collections';
import { settingsCollections } from '@/modules/settings/collections';
import { businessSettings } from '@/modules/settings/globals';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// "Golden Grape <hello@goldengrape.lu>" → name + address for Payload's own e-mails (staff password reset).
const from = () => {
  const match = /^(.*)<(.+)>$/.exec(env.MAIL_FROM);
  return { defaultFromName: match?.[1].trim() || 'Golden Grape', defaultFromAddress: (match?.[2] ?? env.MAIL_FROM).trim() };
};

export default buildConfig({
  admin: {
    user: 'users',
    importMap: { baseDir: dirname },
    // One light theme in Golden Grape colours (styles in app/(payload)/custom.css); no theme switcher.
    theme: 'light',
    meta: { titleSuffix: ' · Golden Grape', icons: [{ rel: 'icon', type: 'image/png', url: '/icon.png' }] },
    components: {
      graphics: { Logo: '@/components/admin/logo', Icon: '@/components/admin/icon' },
      beforeLogin: ['@/components/admin/login-brand'],
      Nav: '@/components/admin/nav',
      actions: ['@/components/admin/language-menu'],
      providers: ['@/components/admin/drawer-links', '@/components/admin/password-toggle'],
      views: { dashboard: { Component: '@/components/admin/dashboard' } },
    },
  },
  collections: [
    ...settingsCollections,
    ...cmsCollections,
    events,
    cateringPackages,
    cateringRequests,
    ...catalogueCollections,
    ...inventoryCollections,
  ],
  globals: [businessSettings, ...cmsGlobals],
  db: mongooseAdapter({
    url: isBuildPhase ? false : env.DATABASE_URL,
    transactionOptions: {},
    // Indexes Payload cannot declare: TTL (`custom.ttl`), and text, descending or partial ones (`custom.indexes`).
    afterOpenConnection: async (adapter) => {
      for (const { slug, custom } of adapter.payload.config.collections) {
        const { collection } = adapter.collections[slug];
        if (custom?.ttl) await collection.createIndex({ [custom.ttl.field]: 1 }, { expireAfterSeconds: custom.ttl.seconds });
        for (const index of (custom?.indexes ?? []) as { fields: IndexSpecification; options?: CreateIndexesOptions }[]) {
          await collection.createIndex(index.fields, index.options);
        }
      }
    },
  }),
  editor: lexicalEditor(),
  // Without SMTP Payload logs its e-mails to the console.
  email: smtpConfigured()
    ? nodemailerAdapter({
        ...from(),
        transportOptions: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        },
      })
    : undefined,
  secret: isBuildPhase ? 'build-phase-no-secret' : env.PAYLOAD_SECRET,
  sharp,
  graphQL: { disable: true },
  // The language of the website text being edited, shown by name ("Texte du site : Português").
  localization: {
    locales: LOCALES.map((code) => ({ code, label: LOCALE_NAMES[code] })),
    defaultLocale: 'fr',
    fallback: true,
  },
  // The language of the admin itself, chosen on the login page or in the header (French until chosen: proxy.ts).
  // A few of Payload's words are replaced by everyday ones for non-technical staff (docs/03-CODING-LAWS.md).
  i18n: {
    supportedLanguages: { fr, en, de, pt },
    fallbackLanguage: 'fr',
    translations: {
      fr: {
        general: {
          locale: 'Texte du site',
          createNew: 'Ajouter',
          updatedSuccessfully: 'Enregistré. Le site est à jour.',
          successfullyCreated: 'Ajouté. Le site est à jour.',
        },
        version: {
          saveDraft: 'Enregistrer sans publier',
          publishChanges: 'Enregistrer et mettre en ligne',
          draftSavedSuccessfully: 'Enregistré, pas encore en ligne.',
          preview: 'Voir sur le site',
        },
      },
      en: {
        general: {
          locale: 'Website text',
          createNew: 'Add',
          updatedSuccessfully: 'Saved. The website is up to date.',
          successfullyCreated: 'Added. The website is up to date.',
        },
        version: {
          saveDraft: 'Save without publishing',
          publishChanges: 'Save and show on website',
          draftSavedSuccessfully: 'Saved, not online yet.',
          preview: 'See it on the website',
        },
      },
      de: {
        general: {
          locale: 'Websitetext',
          createNew: 'Hinzufügen',
          updatedSuccessfully: 'Gespeichert. Die Website ist aktuell.',
          successfullyCreated: 'Hinzugefügt. Die Website ist aktuell.',
        },
        version: {
          saveDraft: 'Speichern, nicht veröffentlichen',
          publishChanges: 'Speichern und online stellen',
          draftSavedSuccessfully: 'Gespeichert, noch nicht online.',
          preview: 'Auf der Website ansehen',
        },
      },
      pt: {
        general: {
          locale: 'Texto do site',
          createNew: 'Adicionar',
          updatedSuccessfully: 'Guardado. O site está atualizado.',
          successfullyCreated: 'Adicionado. O site está atualizado.',
        },
        version: {
          saveDraft: 'Guardar sem publicar',
          publishChanges: 'Guardar e mostrar no site',
          draftSavedSuccessfully: 'Guardado, ainda não está online.',
          preview: 'Ver no site',
        },
      },
    },
  },
  plugins: [
    // Private bucket: files are served through Payload at /api/media/file/… (access control kept).
    s3Storage({
      enabled: s3Configured(),
      collections: { media: true },
      bucket: s3Configured() ? (env.S3_BUCKET ?? '') : '',
      config: s3Configured()
        ? {
            endpoint: env.S3_ENDPOINT,
            region: env.S3_REGION,
            forcePathStyle: Boolean(env.S3_ENDPOINT),
            credentials: { accessKeyId: env.S3_ACCESS_KEY ?? '', secretAccessKey: env.S3_SECRET_KEY ?? '' },
          }
        : {},
    }),
  ],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
