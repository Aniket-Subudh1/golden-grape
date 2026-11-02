import { cacheTag } from 'next/cache';
import type { Locale } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';

// Public CMS reads, cached per locale until the matching afterChange hook expires the tag.

export async function getHeader(locale: Locale) {
  'use cache';
  cacheTag('header');
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'Header', locale, depth: 0 });
}

export async function getFooter(locale: Locale) {
  'use cache';
  cacheTag('footer', 'legal');
  const payload = await getPayloadClient();
  const [footer, legal] = await Promise.all([
    payload.findGlobal({ slug: 'Footer', locale, depth: 0 }),
    payload.find({
      collection: 'legal',
      locale,
      where: { _status: { equals: 'published' } },
      select: { title: true, slug: true },
      sort: 'createdAt',
      limit: 10,
      depth: 0,
    }),
  ]);
  return { ...footer, legal: legal.docs };
}

export async function getHappyHour(locale: Locale) {
  'use cache';
  cacheTag('happy-hour');
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'HappyHour', locale, depth: 1 });
}

async function findPublished(collection: 'pages' | 'legal', slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection,
    locale,
    where: { slug: { equals: slug }, _status: { equals: 'published' } },
    limit: 1,
    depth: 2,
  });
  return docs[0] ?? null;
}

export async function getPage(slug: string, locale: Locale) {
  'use cache';
  cacheTag('pages');
  return findPublished('pages', slug, locale);
}

export async function getLegal(slug: string, locale: Locale) {
  'use cache';
  cacheTag('legal');
  return findPublished('legal', slug, locale);
}
