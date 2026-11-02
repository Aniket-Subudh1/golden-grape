import type { CollectionSlug, PayloadRequest } from 'payload';

type Json = Record<string, unknown>;

export async function audit(
  req: PayloadRequest,
  action: string,
  target: { collection: CollectionSlug; id: string },
  before?: Json,
  after?: Json,
) {
  await req.payload.create({
    collection: 'auditLogs',
    data: {
      user: req.user?.collection === 'users' ? req.user.id : undefined,
      action,
      targetCollection: target.collection,
      docId: target.id,
      before,
      after,
    },
    req,
    overrideAccess: true,
  });
}
