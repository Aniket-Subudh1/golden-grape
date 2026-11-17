'use server';

import { z } from 'zod';
import { action, clientIp, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { staffSignIn, staffSignOut } from './service';

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
