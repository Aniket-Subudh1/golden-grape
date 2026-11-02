import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { env, isBuildPhase, s3Configured, smtpConfigured } from '@/lib/env';
import { cmsCollections } from '@/modules/cms/collections';
import { cmsGlobals } from '@/modules/cms/globals';
import { cateringPackages, cateringRequests } from '@/modules/catering/collections';
import { events } from '@/modules/events/collections';
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
      views: { dashboard: { Component: '@/components/admin/dashboard' } },
    },
  },
  collections: [...settingsCollections, ...cmsCollections, events, cateringPackages, cateringRequests],
  globals: [businessSettings, ...cmsGlobals],
  db: mongooseAdapter({
    url: isBuildPhase ? false : env.DATABASE_URL,
    transactionOptions: {},
    // Payload has no TTL index option; collections declare `custom.ttl` and get one here.
    afterOpenConnection: async (adapter) => {
      for (const { slug, custom } of adapter.payload.config.collections) {
        if (!custom?.ttl) continue;
        await adapter.collections[slug].collection.createIndex(
          { [custom.ttl.field]: 1 },
          { expireAfterSeconds: custom.ttl.seconds },
        );
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
  localization: { locales: ['fr', 'en', 'de', 'pt'], defaultLocale: 'fr', fallback: true },
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
