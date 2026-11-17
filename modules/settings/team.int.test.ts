import { describe, expect, it } from 'vitest';
import { hasRole } from '@/lib/access';
import { getTestPayload, makeStaff } from '@/tests/helpers';
import { createMember, saveGrants, updateMember } from './team';

// Team & access (owner request, 17 Nov): an owner adds people and gives roles other areas; every account's effective
// roles follow at once, a role taken away takes its areas with it, and the team always keeps an owner.

const payload = await getTestPayload();
const read = (id: string) => payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true });

describe('team and access', () => {
  it('an owner adds a person; giving Sales the Stock area applies to them now and to people added later; taking it back removes it', async () => {
    const owner = await makeStaff(payload, ['admin']);
    const ana = await createMember(payload, { name: 'Ana Vendas', email: 'ana-team@example.test', password: 'Strong-pass-1', roles: ['sales'], active: true, locale: 'pt' }, owner.id);
    expect(hasRole(await read(ana.id), ['stock'])).toBe(false);

    await saveGrants(payload, { sales: ['stock'] });
    const after = await read(ana.id);
    expect(after.effectiveRoles).toEqual(['sales', 'stock']);
    expect(hasRole(after, ['stock'])).toBe(true);
    expect(hasRole(after, ['manager'])).toBe(false);
    // Signing in gives the same account (the token carries the effective roles too).
    const login = await payload.login({ collection: 'users', data: { email: 'ana-team@example.test', password: 'Strong-pass-1' }, overrideAccess: true });
    expect(login.user?.effectiveRoles).toEqual(['sales', 'stock']);

    const rui = await createMember(payload, { name: 'Rui', email: 'rui-team@example.test', password: 'Strong-pass-1', roles: ['sales'], active: true, locale: 'fr' }, owner.id);
    expect((await read(rui.id)).effectiveRoles).toEqual(['sales', 'stock']);

    // Moving Rui to Time clock only: Sales' extra area goes with the Sales role.
    await updateMember(payload, rui.id, { name: 'Rui', roles: ['attendance'], active: true, locale: 'fr', password: '' }, owner.id);
    expect((await read(rui.id)).effectiveRoles).toEqual(['attendance']);

    await saveGrants(payload, {});
    expect((await read(ana.id)).effectiveRoles).toEqual(['sales']);
  });

  it('only an owner creates people; an e-mail is used once', async () => {
    const owner = await makeStaff(payload, ['admin']);
    const manager = await makeStaff(payload, ['manager']);
    await expect(createMember(payload, { name: 'X', email: 'x-team@example.test', password: 'Strong-pass-1', roles: ['sales'], active: true, locale: 'fr' }, manager.id)).rejects.toThrow();
    await createMember(payload, { name: 'Y', email: 'y-team@example.test', password: 'Strong-pass-1', roles: ['sales'], active: true, locale: 'fr' }, owner.id);
    await expect(createMember(payload, { name: 'Y2', email: 'Y-team@example.test', password: 'Strong-pass-1', roles: ['sales'], active: true, locale: 'fr' }, owner.id)).rejects.toMatchObject({ message: 'emailTaken' });
  });

  it('an owner cannot disable themselves or drop their own owner role; the last owner stays', async () => {
    const { docs } = await payload.find({ collection: 'users', where: { roles: { contains: 'admin' } }, limit: 0, overrideAccess: true });
    for (const d of docs) await payload.update({ collection: 'users', id: d.id, data: { active: false }, overrideAccess: true });
    const boss = await makeStaff(payload, ['admin']);
    const second = await makeStaff(payload, ['admin']);
    await expect(updateMember(payload, boss.id, { name: 'Boss', roles: ['admin'], active: false, locale: 'fr', password: '' }, boss.id)).rejects.toMatchObject({ message: 'self' });
    await expect(updateMember(payload, boss.id, { name: 'Boss', roles: ['manager'], active: true, locale: 'fr', password: '' }, boss.id)).rejects.toMatchObject({ message: 'self' });
    // Another owner may be made a manager while one owner remains…
    await updateMember(payload, second.id, { name: 'Second', roles: ['manager'], active: true, locale: 'fr', password: '' }, boss.id);
    // …and a new password works at the next sign-in.
    await updateMember(payload, second.id, { name: 'Second', roles: ['manager'], active: true, locale: 'fr', password: 'Another-pass-2' }, boss.id);
    const email = (await read(second.id)).email;
    await expect(payload.login({ collection: 'users', data: { email, password: 'Another-pass-2' }, overrideAccess: true })).resolves.toBeTruthy();
    // Boss is now the only active owner: a second owner cannot disable them.
    const third = await makeStaff(payload, ['admin']);
    await updateMember(payload, third.id, { name: 'Third', roles: ['sales'], active: true, locale: 'fr', password: '' }, boss.id);
    const lone = await makeStaff(payload, ['admin']);
    await updateMember(payload, boss.id, { name: 'Boss', roles: ['admin'], active: true, locale: 'fr', password: '' }, boss.id);
    await updateMember(payload, lone.id, { name: 'Lone', roles: ['admin'], active: false, locale: 'fr', password: '' }, boss.id);
    await expect(updateMember(payload, boss.id, { name: 'Boss', roles: ['manager'], active: true, locale: 'fr', password: '' }, lone.id)).rejects.toMatchObject({ message: 'lastOwner' });
  });
});
