import { describe, expect, it } from 'vitest';
import { getTestPayload, makeStaff } from '@/tests/helpers';

const payload = await getTestPayload();

const makeCustomer = async (name: string) => {
  const doc = await payload.create({
    collection: 'customers',
    data: {
      name,
      email: `${name.toLowerCase()}@example.test`,
      password: 'Customer-Password-1',
      type: 'private',
      locale: 'fr',
      addresses: [{ line1: `${name} street 1`, postalCode: '7795', city: 'Bissen', country: 'LU', isDefault: true }],
    },
    overrideAccess: true,
  });
  return { ...doc, collection: 'customers' as const };
};

const a = await makeCustomer('Ana');
const b = await makeCustomer('Bruno');

describe('customer data is scoped to its owner (AC-M2.2-05)', () => {
  it('find returns only the customer themself', async () => {
    const { docs } = await payload.find({ collection: 'customers', overrideAccess: false, user: a, limit: 0 });
    expect(docs.map((d) => d.id)).toEqual([a.id]);
  });

  it('findByID of another customer is refused, with no data', async () => {
    await expect(payload.findByID({ collection: 'customers', id: b.id, overrideAccess: false, user: a })).rejects.toThrow();
    const own = await payload.findByID({ collection: 'customers', id: a.id, overrideAccess: false, user: a });
    expect(own.addresses?.[0].line1).toBe('Ana street 1');
  });

  it('a customer cannot update another customer or their addresses', async () => {
    await expect(
      payload.update({ collection: 'customers', id: b.id, data: { addresses: [] }, overrideAccess: false, user: a }),
    ).rejects.toThrow();
    const stored = await payload.findByID({ collection: 'customers', id: b.id, overrideAccess: true });
    expect(stored.addresses).toHaveLength(1);
  });

  it('a customer cannot set their own group, payment terms or loyalty points', async () => {
    const group = await payload.create({ collection: 'customerGroups', data: { name: 'Restaurants' }, overrideAccess: true });
    await payload.update({
      collection: 'customers',
      id: a.id,
      data: { group: group.id, paymentTerm: 'net60', loyaltyBalance: 9999, name: 'Ana Silva' },
      overrideAccess: false,
      user: a,
    });
    const stored = await payload.findByID({ collection: 'customers', id: a.id, depth: 0, overrideAccess: true });
    expect(stored).toMatchObject({ name: 'Ana Silva', loyaltyBalance: 0 });
    expect(stored.group ?? null).toBeNull();
    expect(stored.paymentTerm ?? null).toBeNull();
  });

  it('nobody can create a customer through the API except staff (sign-up goes through the rate-limited action)', async () => {
    await expect(
      payload.create({ collection: 'customers', data: { name: 'X', email: 'x@example.test', password: 'Password-123', type: 'private', locale: 'fr' }, overrideAccess: false, user: a }),
    ).rejects.toThrow();
    const sales = await makeStaff(payload, ['sales']);
    await expect(
      payload.create({ collection: 'customers', data: { name: 'Y', email: 'y@example.test', password: 'Password-123', type: 'business', locale: 'fr' }, overrideAccess: false, user: sales }),
    ).resolves.toBeTruthy();
  });

  it('the session token (sent as the website cookie does) resolves to its own customer only', async () => {
    const { token } = await payload.login({ collection: 'customers', data: { email: 'ana@example.test', password: 'Customer-Password-1' } });
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) });
    expect(user).toMatchObject({ id: a.id, collection: 'customers' });
    const { docs } = await payload.find({ collection: 'customers', overrideAccess: false, user: user!, limit: 0 });
    expect(docs.map((d) => d.id)).toEqual([a.id]);
    const { user: nobody } = await payload.auth({ headers: new Headers({ Authorization: 'JWT not-a-token' }) });
    expect(nobody).toBeNull();
  });

  it('a customer token opens nothing staff-only (stock, catalogue costs)', async () => {
    const { docs } = await payload.find({ collection: 'stockMovements', overrideAccess: false, user: a, limit: 0 }).catch(() => ({ docs: [] }));
    expect(docs).toEqual([]);
    await expect(payload.find({ collection: 'variants', overrideAccess: false, user: a })).rejects.toThrow();
  });
});
