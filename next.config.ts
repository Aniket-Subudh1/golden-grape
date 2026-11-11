import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Quotation PDFs (modules/documents/pdf): loaded from node_modules at run time, not bundled (it reads font files).
  serverExternalPackages: ['@react-pdf/renderer'],
  images: { minimumCacheTTL: 60 * 60 * 24 * 7 },
  cacheComponents: true,
  partialPrefetching: true,
  // The back office's Import / Export page sends spreadsheets to server actions (default limit 1 MB).
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default withPayload(nextConfig);
