import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { env, isBuildPhase, s3Configured } from '@/lib/env';
import { cmsCollections } from '@/modules/cms/collections';
import { cmsGlobals } from '@/modules/cms/globals';
import { events } from '@/modules/events/collections';
import { settingsCollections } from '@/modules/settings/collections';
import { businessSettings } from '@/modules/settings/globals';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: { user: 'users', importMap: { baseDir: dirname } },
  collections: [...settingsCollections, ...cmsCollections, events],
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
