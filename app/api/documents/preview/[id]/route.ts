import { connection } from 'next/server';
import { hasRole } from '@/lib/access';
import { getPayloadClient } from '@/lib/payload';
import { quotationPdf } from '@/modules/documents/service';

// "Aperçu du PDF" on a draft quotation: rendered on the fly for sales staff, never stored or sent.

export async function GET(request: Request, { params }: RouteContext<'/api/documents/preview/[id]'>) {
  await connection();
  const { id } = await params;
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  if (!hasRole(user, ['sales']) || !/^[a-f0-9]{24}$/.test(id)) return new Response('Not found', { status: 404 });
  const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!q) return new Response('Not found', { status: 404 });
  const pdf = await quotationPdf(payload, q);
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="apercu-${id}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
