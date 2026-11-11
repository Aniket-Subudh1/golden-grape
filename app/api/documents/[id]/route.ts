import { connection } from 'next/server';
import { hasRole } from '@/lib/access';
import { checkLinkToken } from '@/lib/link-token';
import { getPayloadClient } from '@/lib/payload';
import { currentCustomer } from '@/modules/customers/service';
import { readDocument } from '@/modules/documents/service';

// A stored document (a quotation as sent, as signed): for sales staff, for the customer it belongs to, or for whoever
// holds the link of the e-mail (`?t=`, lib/link-token.ts). Anything else is "not found", never a hint that it exists.

const notFound = () => new Response('Not found', { status: 404 });

export async function GET(request: Request, { params }: RouteContext<'/api/documents/[id]'>) {
  await connection();
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return notFound();
  const payload = await getPayloadClient();
  const file = await readDocument(payload, id);
  if (!file) return notFound();

  let allowed = checkLinkToken('document', id, new URL(request.url).searchParams.get('t'));
  if (!allowed) {
    const { user } = await payload.auth({ headers: request.headers });
    allowed = hasRole(user, ['sales']);
  }
  if (!allowed) {
    const customer = await currentCustomer();
    allowed = Boolean(customer && file.doc.customer && String(typeof file.doc.customer === 'object' ? file.doc.customer.id : file.doc.customer) === customer.id);
  }
  if (!allowed) return notFound();

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file.doc.filename.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
