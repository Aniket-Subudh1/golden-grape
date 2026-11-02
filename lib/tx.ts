import type { MongooseAdapter } from '@payloadcms/db-mongodb';
import {
  type CollectionSlug,
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload';

// Verified against payload 3.92.1: initTransaction(req) sets req.transactionID via db.beginTransaction();
// @payloadcms/db-mongodb keeps the Mongo ClientSession in db.sessions[transactionID] and the mongoose
// model per collection in db.collections[slug]. commitTransaction/killTransaction end and drop the session.

type Session = MongooseAdapter['sessions'][string];
type Model = MongooseAdapter['collections'][string];

export type Tx = { req: PayloadRequest; session: Session; model: (slug: CollectionSlug) => Model };

export const model = (payload: Payload, slug: CollectionSlug): Model =>
  (payload.db as unknown as MongooseAdapter).collections[slug];

export const ping = async (payload: Payload) => {
  await (payload.db as unknown as MongooseAdapter).connection.db?.admin().ping();
};

export async function withTx<T>(payload: Payload, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  const session = (payload.db as unknown as MongooseAdapter).sessions[String(req.transactionID)];
  if (!session) throw new Error('No transaction session: MongoDB must run as a replica set');
  try {
    const result = await fn({ req, session, model: (slug) => model(payload, slug) });
    await commitTransaction(req);
    return result;
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}
