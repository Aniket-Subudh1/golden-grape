import { cacheLife, cacheTag } from 'next/cache';
import type { Payload } from 'payload';
import { env } from '@/lib/env';
import { atRequest, getPayloadClient } from '@/lib/payload';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { ReviewsCache } from '@/payload-types';

// Google reviews (M3.3 T1). Once a day `reviews-refresh` reads the place from the Places API (New), Place Details with
// the field mask below (checked against Google's reference on 17 Nov 2026), and replaces the cache. A failure keeps
// what was there and is logged. The site shows the cache only while it is fresh (3 days): Google's policy does not
// let reviews be kept as our own copy, so a refresh that keeps failing hides them rather than showing old ones.

const FIELDS = 'rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks';
export const FRESH_MS = 3 * 86_400_000;

export type CachedReview = {
  author: string;
  authorUri: string | null;
  photoUri: string | null;
  rating: number;
  text: string;
  language: string | null;
  time: string | null;
  relative: string | null;
  /** `YYYY-MM`: Google asks to show the visit month under reviews of places in France. */
  visit: string | null;
  url: string | null;
  flagUrl: string | null;
};

type PlaceReview = {
  rating?: number;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string; languageCode?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  visitDate?: { year?: number; month?: number };
  googleMapsUri?: string;
  flagContentUri?: string;
};
type Place = { rating?: number; userRatingCount?: number; reviews?: PlaceReview[]; googleMapsUri?: string; googleMapsLinks?: { writeAReviewUri?: string } };

/** The place: Settings › Google reviews, else GOOGLE_PLACE_ID. */
async function placeOf() {
  const settings = await getSettingsPrivate();
  return settings.reviews?.placeId?.trim() || env.GOOGLE_PLACE_ID || null;
}

/** Where "Leave a review" and the QR lead: the link set in Settings, else Google's own, else the place's review form. */
export async function reviewUrl(cache?: Pick<ReviewsCache, 'writeReviewUri'> | null) {
  const settings = await getSettingsPrivate();
  const set = settings.reviews?.reviewUrl?.trim();
  if (set) return set;
  if (cache?.writeReviewUri) return cache.writeReviewUri;
  const place = settings.reviews?.placeId?.trim() || env.GOOGLE_PLACE_ID;
  return place ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place)}` : null;
}

export const reviewOf = (r: PlaceReview): CachedReview => {
  const words = r.originalText?.text ? r.originalText : r.text;
  return {
    author: r.authorAttribution?.displayName ?? '',
    authorUri: r.authorAttribution?.uri ?? null,
    photoUri: r.authorAttribution?.photoUri ?? null,
    rating: Math.round(r.rating ?? 0),
    text: words?.text ?? '',
    language: words?.languageCode ?? null,
    time: r.publishTime ?? null,
    relative: r.relativePublishTimeDescription ?? null,
    visit: r.visitDate?.year && r.visitDate.month ? `${r.visitDate.year}-${String(r.visitDate.month).padStart(2, '0')}` : null,
    url: r.googleMapsUri ?? null,
    flagUrl: r.flagContentUri ?? null,
  };
};

/**
 * The `reviews-refresh` job (and "Refresh now"). Not configured (no key or place, DEP-09) → nothing called. A failed
 * call keeps the previous cache and records the error.
 */
export async function refreshReviews(payload: Payload, { now = new Date(), fetcher = fetch }: { now?: Date; fetcher?: typeof fetch } = {}) {
  const key = env.GOOGLE_PLACES_API_KEY;
  const place = await placeOf();
  if (!key || !place) return { ok: false as const, reason: 'notConfigured' };
  const started = Date.now();
  let place_: Place | null = null;
  let error: string | null = null;
  try {
    const res = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(place)}?languageCode=fr`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as (Place & { error?: { message?: string } }) | null;
    if (!res.ok || !body) error = `HTTP ${res.status}${body?.error?.message ? `: ${body.error.message}` : ''}`;
    else place_ = body;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await payload.create({
    collection: 'integrationLogs',
    data: { target: 'google-places', direction: 'in', request: { place, fields: FIELDS }, response: (error ? { error } : { rating: place_?.rating, total: place_?.userRatingCount, reviews: place_?.reviews?.length ?? 0 }) as never, ok: !error, ms: Date.now() - started, expiresAt: new Date(now.getTime() + 90 * 86_400_000).toISOString() },
    overrideAccess: true,
    depth: 0,
  });
  if (error || !place_) {
    await payload.updateGlobal({ slug: 'ReviewsCache', data: { lastError: error, lastErrorAt: now.toISOString() }, overrideAccess: true, context: { skipRevalidate: true } });
    return { ok: false as const, reason: error ?? 'empty' };
  }
  const reviews = (place_.reviews ?? []).slice(0, 5).map(reviewOf).filter((r) => r.text);
  await payload.updateGlobal({
    slug: 'ReviewsCache',
    data: {
      rating: place_.rating ?? null,
      total: place_.userRatingCount ?? null,
      reviews: reviews as never,
      mapsUri: place_.googleMapsUri ?? null,
      writeReviewUri: place_.googleMapsLinks?.writeAReviewUri ?? null,
      attributionHtml: 'Google Maps',
      fetchedAt: now.toISOString(),
      lastError: null,
    },
    overrideAccess: true,
  });
  return { ok: true as const, rating: place_.rating ?? null, total: place_.userRatingCount ?? null, reviews: reviews.length };
}

/** The cache, if it has data and is fresh; else null (the home page then shows no review section). */
export async function freshReviews(payload: Payload, now = new Date()) {
  const cache = await payload.findGlobal({ slug: 'ReviewsCache', depth: 0, overrideAccess: true });
  if (!cache.fetchedAt || now.getTime() - new Date(cache.fetchedAt).getTime() > FRESH_MS) return null;
  if (!cache.rating && !((cache.reviews as CachedReview[] | null)?.length ?? 0)) return null;
  return { ...cache, reviews: (cache.reviews ?? []) as CachedReview[] };
}

/** The home page's reviews: fresh ones only; refreshed hourly and when the cache changes. */
async function siteReviewsCached() {
  'use cache';
  cacheTag('reviews', 'settings');
  cacheLife('hours');
  const payload = await getPayloadClient();
  const settings = await getSettingsPrivate();
  if (settings.modules?.reviews !== true) return null;
  const fresh = await freshReviews(payload);
  return fresh && { rating: fresh.rating ?? null, total: fresh.total ?? null, reviews: fresh.reviews, mapsUri: fresh.mapsUri ?? null };
}
export const siteReviews = atRequest(siteReviewsCached);
