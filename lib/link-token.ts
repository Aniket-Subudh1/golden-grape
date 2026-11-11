import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

// Links that open one document without an account: an order's confirmation page, a quotation sent to a customer, its
// PDF. The token is an HMAC of the kind and the id with PAYLOAD_SECRET, so a link opens that document only, and a
// token for one kind never opens another (an order's token is not a quotation's).

export type LinkKind = 'order' | 'quotation' | 'document';

const sign = (kind: LinkKind, id: string) => createHmac('sha256', env.PAYLOAD_SECRET).update(`${kind}:${id}`).digest('base64url').slice(0, 32);

export const linkToken = (kind: LinkKind, id: string) => sign(kind, id);

export function checkLinkToken(kind: LinkKind, id: string, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(sign(kind, id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
