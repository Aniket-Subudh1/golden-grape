import config from '@payload-config';
import { connection } from 'next/server';
import { getPayload } from 'payload';

// getPayload caches the initialised instance per process.
export const getPayloadClient = () => getPayload({ config });

/**
 * Wraps a cached read so it only runs at request time: `next build` has no database, so with Cache
 * Components the regions that read Payload sit behind <Suspense> and are not part of the static shell.
 * The `'use cache'` inside `read` still caches the result between requests.
 */
export const atRequest =
  <A extends unknown[], R>(read: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    await connection();
    return read(...args);
  };
