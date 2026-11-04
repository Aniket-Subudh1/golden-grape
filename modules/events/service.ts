import { cacheLife, cacheTag } from 'next/cache';
import type { Locale } from '@/lib/i18n';
import { atRequest, getPayloadClient } from '@/lib/payload';

/** Published events that have not started yet, soonest first. Refreshed hourly and on every edit. */
async function upcomingCached(locale: Locale, limit = 24) {
  'use cache';
  cacheTag('events');
  cacheLife('hours');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'events',
    locale,
    where: { _status: { equals: 'published' }, startsAt: { greater_than_equal: new Date().toISOString() } },
    sort: 'startsAt',
    limit,
    depth: 1,
  });
  return docs;
}

async function eventCached(slug: string, locale: Locale) {
  'use cache';
  cacheTag('events');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'events',
    locale,
    where: { slug: { equals: slug }, _status: { equals: 'published' } },
    limit: 1,
    depth: 1,
  });
  return docs[0] ?? null;
}

export const upcomingEvents = atRequest(upcomingCached);
export const getEvent = atRequest(eventCached);

/** Every published event's slug and last change, for the sitemap. */
export async function publishedEventSlugs() {
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'events', where: { _status: { equals: 'published' } }, limit: 0, depth: 0, select: { slug: true, updatedAt: true } });
  return docs;
}
