import type { GlobalConfig } from 'payload';
import { isStaff, none } from '@/lib/access';
import { l } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';

// The latest Google reviews (M3.3 T1, 04 §7): written by the daily `reviews-refresh` job, replaced each time, read by
// the home page and the admin's review overview. Never edited by hand (hidden; the overview is /admin/reviews).
export const reviewsCache: GlobalConfig = {
  slug: 'ReviewsCache',
  label: l('Avis Google', 'Google reviews', 'Google-Bewertungen', 'Avaliações Google'),
  admin: { hidden: true },
  access: { read: isStaff('manager'), update: none },
  hooks: { afterChange: [revalidateTagHook('reviews')] },
  fields: [
    { name: 'rating', type: 'number' },
    { name: 'total', type: 'number' },
    // { author, authorUri, photoUri, rating, text, language, time (RFC 3339), relative, visit (YYYY-MM), url, flagUrl }
    { name: 'reviews', type: 'json' },
    { name: 'mapsUri', type: 'text' },
    { name: 'writeReviewUri', type: 'text' },
    { name: 'attributionHtml', type: 'text' },
    { name: 'fetchedAt', type: 'date' },
    { name: 'lastError', type: 'text' },
    { name: 'lastErrorAt', type: 'date' },
  ],
};
