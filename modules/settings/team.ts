import type { Payload } from 'payload';
import { effectiveRoles, GRANTABLE, type Grantable, type Grants, type Role } from '@/lib/access';
import { AppError } from '@/lib/errors';
import { model } from '@/lib/tx';

// Team & access (/admin/team): the owner adds people (staff, other owners), changes their roles or switches them off,
// and gives roles the areas of others. Accounts are written through Payload with the owner as the user (its access
// rules and hooks apply); the areas are saved in Settings and every account's effective roles worked out again.

export type MemberInput = { name: string; email?: string; password?: string; roles: Role[]; active: boolean; locale: 'fr' | 'en' | 'de' | 'pt' };

/** Active owners other than `except`: the team always keeps one who can sign in. */
async function otherOwners(payload: Payload, except?: string) {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { and: [{ roles: { contains: 'admin' } }, { active: { not_equals: false } }, ...(except ? [{ id: { not_equals: except } }] : [])] },
    overrideAccess: true,
  });
  return totalDocs;
}

const emailTaken = (error: unknown) => error instanceof Error && /email|unique|duplicate|E11000/i.test(`${error.message} ${JSON.stringify((error as { data?: unknown }).data ?? '')}`);

export async function createMember(payload: Payload, input: MemberInput, by: string) {
  if (!input.email || !input.password) throw new AppError('VALIDATION', 'required', !input.email ? 'email' : 'password');
  const owner = await payload.findByID({ collection: 'users', id: by, depth: 0, overrideAccess: true });
  const exists = await payload.count({ collection: 'users', where: { email: { equals: input.email.toLowerCase() } }, overrideAccess: true });
  if (exists.totalDocs) throw new AppError('CONFLICT', 'emailTaken', 'email');
  try {
    return await payload.create({
      collection: 'users',
      data: { name: input.name, email: input.email.toLowerCase(), password: input.password, roles: input.roles, active: input.active, locale: input.locale },
      user: { ...owner, collection: 'users' },
      overrideAccess: false,
      depth: 0,
    });
  } catch (error) {
    if (emailTaken(error)) throw new AppError('CONFLICT', 'emailTaken', 'email');
    throw error;
  }
}

export async function updateMember(payload: Payload, id: string, input: Omit<MemberInput, 'email'>, by: string) {
  const before = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!before) throw new AppError('NOT_FOUND', 'member');
  if (id === by && !input.active) throw new AppError('VALIDATION', 'self', 'active');
  if (id === by && !input.roles.includes('admin')) throw new AppError('VALIDATION', 'self', 'roles');
  const wasOwner = before.roles?.includes('admin') && before.active !== false;
  const staysOwner = input.roles.includes('admin') && input.active;
  if (wasOwner && !staysOwner && (await otherOwners(payload, id)) === 0) throw new AppError('CONFLICT', 'lastOwner', 'roles');
  const owner = await payload.findByID({ collection: 'users', id: by, depth: 0, overrideAccess: true });
  return payload.update({
    collection: 'users',
    id,
    data: { name: input.name, roles: input.roles, active: input.active, locale: input.locale, ...(input.password ? { password: input.password } : {}) },
    user: { ...owner, collection: 'users' },
    overrideAccess: false,
    depth: 0,
  });
}

/** Keeps only real grants: known roles, never a role's own area, never the owner's. */
export function cleanGrants(grants: Record<string, unknown>): Grants {
  const out: Grants = {};
  for (const role of GRANTABLE) {
    const given = Array.isArray(grants[role]) ? (grants[role] as unknown[]) : [];
    const areas = GRANTABLE.filter((a) => a !== role && given.includes(a));
    if (areas.length) out[role] = areas as Grantable[];
  }
  return out;
}

/** Saves the areas each role is given and works out every account's effective roles again. */
export async function saveGrants(payload: Payload, grants: Record<string, unknown>) {
  const clean = cleanGrants(grants);
  // Only this field: saving the whole settings would re-check unrelated required fields (a shop not yet filled in).
  const globals = (payload.db as unknown as { globals: { updateOne: (q: object, u: object, o: object) => Promise<unknown> } }).globals;
  await globals.updateOne({ globalType: 'BusinessSettings' }, { $set: { 'access.grants': clean } }, { upsert: true });
  const users = model(payload, 'users');
  const all = await users.find({}, { roles: 1 }).lean<{ _id: unknown; roles?: string[] }[]>();
  for (const u of all) await users.updateOne({ _id: u._id }, { $set: { effectiveRoles: effectiveRoles(u.roles, clean) } });
  return { grants: clean, accounts: all.length };
}
