import config from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { afterAll } from 'vitest';

// Payload on the replica set started by tests/setup-int.ts. Call at the top level of a test file.
export async function getTestPayload(): Promise<Payload> {
  const payload = await getPayload({ config });
  // Wait for index builds: a transaction that races one fails with "Unable to acquire IX lock".
  await Promise.all(Object.values(payload.db.collections).map((model) => model.init()));
  afterAll(() => payload.destroy());
  return payload;
}
