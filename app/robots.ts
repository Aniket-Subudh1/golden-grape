import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/env';

// Private paths stay out of search engines (M2.2 T5); the account and checkout pages live under each language.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/staff', '/api', '/account', '/checkout', '/order', '/auth', '/*/account', '/*/checkout', '/*/order', '/*/auth'],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
