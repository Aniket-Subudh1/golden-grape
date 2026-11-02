import { describe, expect, it } from 'vitest';
import { getTestPayload, makeStaff } from '@/tests/helpers';
import { isModuleOn } from './service';

const payload = await getTestPayload();

describe('staff access', () => {
  it('rejects the login of an inactive user', async () => {
    const user = await makeStaff(payload, ['sales'], { active: false });
    await expect(payload.login({ collection: 'users', data: { email: user.email, password: 'Test-Password-1' } })).rejects.toThrow();
  });

  it('lets an active user log in (control)', async () => {
    const user = await makeStaff(payload, ['sales']);
    await expect(payload.login({ collection: 'users', data: { email: user.email, password: 'Test-Password-1' } })).resolves.toHaveProperty('token');
  });

  it('forbids a sales user to update BusinessSettings', async () => {
    const sales = await makeStaff(payload, ['sales']);
    await expect(
      payload.updateGlobal({ slug: 'BusinessSettings', data: { modules: { attendance: true } }, user: sales, overrideAccess: false }),
    ).rejects.toThrow();
  });

  it('forbids a stock user to read BusinessSettings, allows a manager', async () => {
    const stock = await makeStaff(payload, ['stock']);
    const manager = await makeStaff(payload, ['manager']);
    await expect(payload.findGlobal({ slug: 'BusinessSettings', user: stock, overrideAccess: false })).rejects.toThrow();
    await expect(payload.findGlobal({ slug: 'BusinessSettings', user: manager, overrideAccess: false })).resolves.toBeTruthy();
  });

  it('ignores a non-admin who tries to give themselves the admin role', async () => {
    const sales = await makeStaff(payload, ['sales']);
    const updated = await payload.update({ collection: 'users', id: sales.id, data: { roles: ['admin'] }, user: sales, overrideAccess: false });
    expect(updated.roles).toEqual(['sales']);
  });

  it('stops an admin from removing their own admin role', async () => {
    const admin = await makeStaff(payload, ['admin']);
    await expect(
      payload.update({ collection: 'users', id: admin.id, data: { roles: ['manager'] }, user: admin, overrideAccess: false }),
    ).rejects.toThrow(/own admin role/);
  });

  it('reports a module that is switched off as off', async () => {
    await payload.updateGlobal({
      slug: 'BusinessSettings',
      data: {
        business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' },
        modules: { attendance: false, reviews: true },
      },
      overrideAccess: true,
      context: { skipRevalidate: true },
    });
    expect(await isModuleOn('attendance')).toBe(false);
    expect(await isModuleOn('reviews')).toBe(true);
  });
});
