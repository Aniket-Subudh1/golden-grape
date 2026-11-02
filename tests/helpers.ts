import config from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { afterAll } from 'vitest';
import { indexesReady } from '@/lib/tx';

// Payload on the replica set started by tests/setup-int.ts. Call at the top level of a test file.
export async function getTestPayload(): Promise<Payload> {
  const payload = await getPayload({ config });
  await indexesReady(payload);
  afterAll(() => payload.destroy());
  return payload;
}
