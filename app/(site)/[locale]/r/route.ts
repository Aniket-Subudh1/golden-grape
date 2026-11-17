import { connection } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { reviewUrl } from '@/modules/reviews/service';
import { getSettingsPrivate } from '@/modules/settings/service';

// The review short link (M3.3 T1, AC-M3.3-01): `/r` (the QR on table cards, receipts and packaging) → the place's
// Google review form. Not found while the reviews module is off or no place is set.
export async function GET() {
  await connection();
  const settings = await getSettingsPrivate();
  if (settings.modules?.reviews !== true) return new Response('Not found', { status: 404 });
  const payload = await getPayloadClient();
  const cache = await payload.findGlobal({ slug: 'ReviewsCache', depth: 0, overrideAccess: true });
  const to = await reviewUrl(cache);
  if (!to) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
