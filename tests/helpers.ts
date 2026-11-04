import config from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { afterAll } from 'vitest';
import type { Role } from '@/lib/access';
import { indexesReady, withTx } from '@/lib/tx';
import { postMovements } from '@/modules/inventory/service';
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

let variantCount = 0;

/**
 * A product with its default variant at `price` cents, optional packaging units (one per factor) and `onHand` units
 * already in stock (posted as a receipt, so ledger and cache agree).
 */
export async function makeVariant(
  payload: Payload,
  { onHand = 0, price = 1000, packaging = [], kind = 'wine' }: { onHand?: number; price?: number; packaging?: number[]; kind?: 'wine' | 'snack' } = {},
) {
  variantCount += 1;
  const categoryKind = kind === 'snack' ? 'snack' : 'shop';
  const found = await payload.find({ collection: 'categories', where: { slug: { equals: `test-${categoryKind}` } }, limit: 1, overrideAccess: true });
  const category =
    found.docs[0] ?? (await payload.create({ collection: 'categories', data: { name: `Test ${categoryKind}`, slug: `test-${categoryKind}`, kind: categoryKind }, overrideAccess: true }));
  const product = await payload.create({
    collection: 'products',
    data: { name: `Test product ${variantCount}`, kind, category: category.id, vatClass: 'standard', firstVariant: { priceCents: price } } as never,
    overrideAccess: true,
  });
  const { docs } = await payload.find({ collection: 'variants', where: { product: { equals: product.id } }, limit: 1, overrideAccess: true });
  const variant = docs[0];
  const units: Record<number, string> = {};
  for (const factor of packaging) {
    units[factor] = (await payload.create({ collection: 'packagingUnits', data: { variant: variant.id, factor, label: `Box of ${factor}` }, overrideAccess: true })).id;
  }
  if (onHand) await withTx(payload, (tx) => postMovements(tx, [{ variant: variant.id, unitQty: onHand, type: 'receipt', channel: 'backoffice' }]));
  return { product, variant, units };
}

/** Runs `fn` n times at once and returns every outcome (fulfilled or rejected). */
export const parallel = <T>(n: number, fn: (i: number) => Promise<T>) => Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
