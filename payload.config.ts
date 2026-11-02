import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { env, isBuildPhase } from '@/lib/env';
import { settingsCollections } from '@/modules/settings/collections';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: { user: 'users', importMap: { baseDir: dirname } },
  collections: [...settingsCollections],
  db: mongooseAdapter({ url: isBuildPhase ? false : env.DATABASE_URL, transactionOptions: {} }),
  editor: lexicalEditor(),
  secret: isBuildPhase ? 'build-phase-no-secret' : env.PAYLOAD_SECRET,
  sharp,
  graphQL: { disable: true },
  localization: { locales: ['fr', 'en', 'de', 'pt'], defaultLocale: 'fr', fallback: true },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
