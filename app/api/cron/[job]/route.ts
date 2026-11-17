import { timingSafeEqual } from 'node:crypto';
import { connection } from 'next/server';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { getPayloadClient } from '@/lib/payload';
import { expireQuotations } from '@/modules/documents/service';
import { lowStockDigest } from '@/modules/inventory/jobs';
import { processOutbox } from '@/modules/pos/service';
import { expirePoints } from '@/modules/promotions/rewards';
import { refreshReviews } from '@/modules/reviews/service';

// Scheduled jobs, called by the host's cron with `Authorization: Bearer $CRON_SECRET` (02-ARCHITECTURE §7). No
// secret configured → every call is refused.
//   quotations-expire (daily): sent quotations past their last valid day become "Expiré".
//   low-stock-digest (daily, 07:00 Luxembourg): one e-mail listing every size at or below its level (M3.1 T6).
//   loyalty-expire (daily): loyalty points past their validity expire, oldest first (M3.2 T3).
//   reviews-refresh (daily): the Google rating and latest reviews (M3.3 T1); nothing called without a key and a place.
//   outbox-process (every minute): messages queued for the till are sent, with backoff (M3.3 T5).

const authorized = (header: string | null) => {
  const secret = env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: Request, { params }: RouteContext<'/api/cron/[job]'>) {
  await connection();
  if (!authorized(request.headers.get('authorization'))) return Response.json({ ok: false }, { status: 401 });
  const { job } = await params;
  const payload = await getPayloadClient();
  if (job === 'quotations-expire') {
    const expired = await expireQuotations(payload);
    for (const q of expired) await audit(payload, { action: 'quotation.expired', collection: 'quotations', id: q.id, ref: q.number });
    return Response.json({ ok: true, job, expired: expired.map((q) => q.number) });
  }
  if (job === 'low-stock-digest') return Response.json({ ok: true, job, ...(await lowStockDigest(payload)) });
  if (job === 'loyalty-expire') return Response.json({ ok: true, job, points: await expirePoints(payload) });
  if (job === 'reviews-refresh') return Response.json({ job, ...(await refreshReviews(payload)) });
  if (job === 'outbox-process') return Response.json({ ok: true, job, ...(await processOutbox(payload)) });
  return Response.json({ ok: false, job }, { status: 404 });
}
