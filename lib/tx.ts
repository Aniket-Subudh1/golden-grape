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

/** Waits for every model's index builds: on a fresh database, a transaction that races one fails with
 * "Unable to acquire IX lock". Used before the first writes of the seed and the integration tests. */
export const indexesReady = async (payload: Payload) => {
  await Promise.all(Object.values((payload.db as unknown as MongooseAdapter).collections).map((m) => m.init()));
};

export const ping = async (payload: Payload) => {
  await (payload.db as unknown as MongooseAdapter).connection.db?.admin().ping();
};

// Two transactions writing the same document (two sales of one wine) make MongoDB abort the later one with a
// WriteConflict labelled TransientTransactionError. Like the driver's own withTransaction, the whole function is
// run again on a fresh transaction: nothing of the aborted attempt was written.
const MAX_ATTEMPTS = 50;
const isTransient = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  Array.isArray((error as { errorLabels?: unknown }).errorLabels) &&
  (error as { errorLabels: string[] }).errorLabels.some((label) => label === 'TransientTransactionError' || label === 'UnknownTransactionCommitResult');

export async function withTx<T>(payload: Payload, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
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
      if (!isTransient(error) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * Math.min(200, 5 * attempt)));
    }
  }
}
