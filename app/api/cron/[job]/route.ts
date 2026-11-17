import { timingSafeEqual } from 'node:crypto';
import { connection } from 'next/server';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { getPayloadClient } from '@/lib/payload';
import { expireQuotations } from '@/modules/documents/service';
import { lowStockDigest } from '@/modules/inventory/jobs';

// Scheduled jobs, called by the host's cron with `Authorization: Bearer $CRON_SECRET` (02-ARCHITECTURE §7). No
// secret configured → every call is refused.
//   quotations-expire (daily): sent quotations past their last valid day become "Expiré".
//   low-stock-digest (daily, 07:00 Luxembourg): one e-mail listing every size at or below its level (M3.1 T6).

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
  return Response.json({ ok: false, job }, { status: 404 });
}
