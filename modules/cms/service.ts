import { cacheTag } from 'next/cache';
import type { Locale } from '@/lib/i18n';
import type { Media } from '@/payload-types';
import { atRequest, getPayloadClient } from '@/lib/payload';

// Public CMS reads, cached per locale until the matching afterChange hook expires the tag.

async function headerCached(locale: Locale) {
  'use cache';
  cacheTag('header');
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'Header', locale, depth: 0 });
}

async function footerCached(locale: Locale) {
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

async function happyHourCached(locale: Locale) {
  'use cache';
  cacheTag('happy-hour');
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'HappyHour', locale, depth: 1 });
}

async function homePageCached(locale: Locale) {
  'use cache';
  cacheTag('home');
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'HomePage', locale, depth: 1 });
}

const publishedSlug = (slug: string) => ({ slug: { equals: slug }, _status: { equals: 'published' as const } });

async function pageCached(slug: string, locale: Locale) {
  'use cache';
  cacheTag('pages');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'pages', locale, where: publishedSlug(slug), limit: 1, depth: 2 });
  return docs[0] ?? null;
}

async function legalCached(slug: string, locale: Locale) {
  'use cache';
  cacheTag('legal');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'legal', locale, where: publishedSlug(slug), limit: 1, depth: 0 });
  return docs[0] ?? null;
}

/** `src`/`alt` of a populated upload field; null when unset or not populated. */
export function mediaOf(value: string | Media | null | undefined) {
  if (!value || typeof value === 'string' || !value.url) return null;
  return { src: value.url, alt: value.alt ?? '' };
}

export const getHeader = atRequest(headerCached);
export const getFooter = atRequest(footerCached);
export const getHappyHour = atRequest(happyHourCached);
export const getHomePage = atRequest(homePageCached);
export const getPage = atRequest(pageCached);
export const getLegal = atRequest(legalCached);
