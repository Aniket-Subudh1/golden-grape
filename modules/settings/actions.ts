'use server';

import { z } from 'zod';
import { action, clientIp, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { staffSignIn, staffSignOut } from './service';
import { createMember, saveGrants, updateMember } from './team';

// Staff sign-in for the phone screens (M3.1 T1). Error messages are dictionary keys (`staff.login.*`, `form.fields.*`).

export const staffSignInAction = publicAction(z.object({ email: z.email('email').max(200, 'tooLong'), password: z.string().min(1, 'required').max(200, 'tooLong') }), async (input, { payload }) => {
  // 5 attempts per 15 minutes for one e-mail from one address, as for shop accounts.
  await rateLimit(`staff-login:${input.email.toLowerCase()}:${await clientIp()}`, 5, 15 * 60_000);
  const user = await staffSignIn(payload, input.email, input.password);
  return { name: user.name };
});

export const staffSignOutAction = action(z.object({}), { roles: [] }, async (_, { payload }) => {
  await staffSignOut(payload);
  return {};
});

/** The staff member's own language (staff sidebar, phone home): the staff screens and e-mails to them speak it. */
export const setStaffLanguage = action(z.object({ locale: z.enum(LOCALES) }), { roles: [] }, async ({ locale }, { payload, user }) => {
  await payload.update({ collection: 'users', id: user.id, data: { locale }, overrideAccess: true, depth: 0 });
  return { locale };
});

// ---- Team & access (/admin/team): the owner only. -------------------------------------------------------------------

const role = z.enum(['admin', 'manager', 'sales', 'stock', 'attendance']);
const member = {
  name: z.string().trim().min(2, 'required').max(80, 'tooLong'),
  roles: z.array(role).min(1, 'rolesRequired'),
  active: z.boolean(),
  locale: z.enum(LOCALES),
};

export const createTeamMember = action(
  z.object({ ...member, email: z.email('email').max(200, 'tooLong'), password: z.string().min(10, 'passwordShort').max(200, 'tooLong') }),
  { roles: ['admin'] },
  async (input, { payload, user }) => {
    const created = await createMember(payload, input, user.id);
    await audit(payload, { user: user.id, action: 'doc.create', collection: 'users', id: created.id, ref: created.email, after: { roles: created.roles } });
    return { id: created.id };
  },
);

export const updateTeamMember = action(
  z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), ...member, password: z.union([z.literal(''), z.string().min(10, 'passwordShort').max(200, 'tooLong')]) }),
  { roles: ['admin'] },
  async ({ id, ...input }, { payload, user }) => {
    const before = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true });
    const updated = await updateMember(payload, id, input, user.id);
    await audit(payload, { user: user.id, action: 'doc.update', collection: 'users', id, ref: updated.email, before: { roles: before?.roles, active: before?.active }, after: { roles: updated.roles, active: updated.active, ...(input.password ? { password: 'changed' } : {}) } });
    return { id };
  },
);

export const saveAccessGrants = action(z.object({ grants: z.record(z.string(), z.array(z.string()).max(4)) }), { roles: ['admin'] }, async ({ grants }, { payload, user }) => {
  const result = await saveGrants(payload, grants);
  await audit(payload, { user: user.id, action: 'doc.update', collection: 'BusinessSettings', id: 'access', ref: 'Team & access', after: { grants: result.grants } });
  return result;
});
