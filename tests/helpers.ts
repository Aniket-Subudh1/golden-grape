import config from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { afterAll } from 'vitest';
import type { Role } from '@/lib/access';
import { indexesReady } from '@/lib/tx';
import type { User } from '@/payload-types';

// Payload on the replica set started by tests/setup-int.ts. Call at the top level of a test file.
export async function getTestPayload(): Promise<Payload> {
  const payload = await getPayload({ config });
  await indexesReady(payload);
  afterAll(() => payload.destroy());
  return payload;
}

let staffCount = 0;

/** A staff user with the given role(s); returned with `collection` so it can be passed as `user`. */
export async function makeStaff(payload: Payload, roles: Role[], extra: Partial<User> = {}) {
  staffCount += 1;
  const user = await payload.create({
    collection: 'users',
    data: { email: `staff${staffCount}@example.test`, password: 'Test-Password-1', name: `Staff ${staffCount}`, roles, locale: 'fr', ...extra },
    overrideAccess: true,
  });
  return { ...user, collection: 'users' as const };
}
