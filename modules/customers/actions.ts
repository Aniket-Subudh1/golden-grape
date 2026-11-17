'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { action, clientIp, optionalPhoneField, phoneField, publicAction } from '@/lib/action';
import { AppError } from '@/lib/errors';
import { LOCALES } from '@/lib/i18n';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import {
  changePassword,
  createCustomerByStaff,
  searchCustomers,
  updateCustomerByStaff,
  currentCustomer,
  deleteAddress,
  forgotPassword,
  resetPassword,
  saveAddress,
  setDefaultAddress,
  signIn,
  signOut,
  signUp,
  signUpFromOrder,
  updateProfile,
} from './service';
import { mailWelcome } from './mail';
import { isVatNumber } from './vat';

// Error messages are dictionary keys (`form.fields.*`), translated by ActionForm.

const email = z.email('email').max(200, 'tooLong');
const password = z.string().min(8, 'password').max(200, 'tooLong');
const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => text(max).min(1, 'required');
const checkbox = z.union([z.literal('on'), z.literal('true'), z.boolean()]).optional().transform((v) => v === 'on' || v === 'true' || v === true);

/** The signed-in customer, or FORBIDDEN: every account action acts on its own customer only. */
async function me() {
  const customer = await currentCustomer();
  if (!customer) throw new AppError('FORBIDDEN', 'signedOut');
  return customer;
}

export const signInAction = publicAction(z.object({ email, password: z.string().min(1, 'required') }), async (input, { payload }) => {
  // 5 attempts per 15 minutes for one e-mail from one address (M2.2 T4).
  await rateLimit(`login:${input.email.toLowerCase()}:${await clientIp()}`, 5, 15 * 60_000);
  const customer = await signIn(payload, input);
  return { name: customer.name };
});

export const signUpAction = publicAction(
  z
    .object({
      name: required(120),
      email,
      password,
      phone: optionalPhoneField,
      type: z.enum(['private', 'business']),
      company: text(160).optional(),
      vatNumber: text(40).optional(),
      marketingConsent: checkbox,
      locale: z.enum(LOCALES),
    })
    .superRefine((input, ctx) => {
      if (input.type !== 'business') return;
      if (!input.company) ctx.addIssue({ code: 'custom', path: ['company'], message: 'required' });
      if (!input.vatNumber) ctx.addIssue({ code: 'custom', path: ['vatNumber'], message: 'required' });
      else if (!isVatNumber(input.vatNumber)) ctx.addIssue({ code: 'custom', path: ['vatNumber'], message: 'vatNumber' });
    }),
  async (input, { payload }) => {
    // 5 sign-ups per hour from one address (M2.2 T4).
    await rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000);
    const customer = await signUp(payload, input);
    after(() => mailWelcome(customer).catch((error) => console.error('[mail] welcome', error)));
    return { name: customer.name };
  },
);

/** Account from a guest's confirmation page (GG-010): only a password to choose; same limit as sign-up. */
export const signUpFromOrderAction = publicAction(
  z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'invalid'), token: z.string().min(1).max(100), password, locale: z.enum(LOCALES) }),
  async (input, { payload }) => {
    await rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000);
    const customer = await signUpFromOrder(payload, input);
    after(() => mailWelcome(customer).catch((error) => console.error('[mail] welcome', error)));
    return { name: customer.name };
  },
);

export const signOutAction = publicAction(z.object({}), async () => {
  await signOut();
  return {};
});

export const forgotPasswordAction = publicAction(z.object({ email }), async (input, { payload }) => {
  await rateLimit(`forgot:${await clientIp()}`, 5, 60 * 60_000);
  await forgotPassword(payload, input.email);
  return {};
});

export const resetPasswordAction = publicAction(
  z.object({ token: z.string().min(1, 'resetExpired'), password, confirm: z.string() }).refine((i) => i.password === i.confirm, { path: ['confirm'], message: 'mismatch' }),
  async (input, { payload }) => {
    const customer = await resetPassword(payload, { token: input.token, password: input.password });
    return { name: customer.name };
  },
);

export const updateProfileAction = publicAction(
  z.object({
    name: required(120),
    phone: optionalPhoneField,
    locale: z.enum(LOCALES),
    marketingConsent: checkbox,
    company: text(160).optional(),
    vatNumber: text(40)
      .optional()
      .refine((v) => !v || isVatNumber(v), 'vatNumber'),
  }),
  async (input, { payload }) => {
    const customer = await me();
    if (customer.type === 'business' && !input.company) throw new AppError('VALIDATION', 'required', 'company');
    if (customer.type === 'business' && !input.vatNumber) throw new AppError('VALIDATION', 'required', 'vatNumber');
    await updateProfile(payload, customer, input);
    return {};
  },
);

export const changePasswordAction = publicAction(
  z.object({ current: z.string().min(1, 'required'), password, confirm: z.string() }).refine((i) => i.password === i.confirm, { path: ['confirm'], message: 'mismatch' }),
  async (input, { payload }) => {
    await changePassword(payload, await me(), input);
    return {};
  },
);

export const saveAddressAction = publicAction(
  z.object({
    id: z.string().optional(),
    label: text(60).optional(),
    line1: required(160),
    line2: text(160).optional(),
    postalCode: required(12),
    city: required(80),
    country: z.string().trim().length(2, 'invalid').toUpperCase(),
    isDefault: checkbox,
  }),
  async (input, { payload }) => {
    await saveAddress(payload, await me(), { ...input, id: input.id || undefined });
    return {};
  },
);

export const deleteAddressAction = publicAction(z.object({ id: z.string().min(1) }), async (input, { payload }) => {
  await deleteAddress(payload, await me(), input.id);
  return {};
});

export const setDefaultAddressAction = publicAction(z.object({ id: z.string().min(1) }), async (input, { payload }) => {
  await setDefaultAddress(payload, await me(), input.id);
  return {};
});

// ---------------------------------------------------------------------------------------------------------------
// Staff phone screens (M3.1 T5): find, create and edit customers. The e-mail is optional at the till (A-16).

const staffRoles = { roles: ['sales' as const, 'manager' as const] };
const staffCustomer = z
  .object({
    name: required(120),
    phone: phoneField,
    email: z.union([z.literal(''), email]).optional(),
    type: z.enum(['private', 'business']),
    company: text(160).optional(),
    vatNumber: text(40).optional(),
    locale: z.enum(LOCALES),
  })
  .superRefine((d, ctx) => {
    if (d.type !== 'business') return;
    if (!d.company) ctx.addIssue({ code: 'custom', path: ['company'], message: 'required' });
    if (d.vatNumber && !isVatNumber(d.vatNumber)) ctx.addIssue({ code: 'custom', path: ['vatNumber'], message: 'vatNumber' });
  });

export const findCustomers = action(z.object({ q: z.string().trim().min(2).max(80) }), staffRoles, async ({ q }, { payload }) =>
  (await searchCustomers(payload, q)).map((c) => ({ id: c.id, name: c.name, company: c.company ?? null, phone: c.phone ?? null, email: c.email, type: c.type })),
);

export const createCustomerStaff = action(staffCustomer, staffRoles, async (input, { payload, user }) => {
  const customer = await createCustomerByStaff(payload, input);
  await audit(payload, { user: user.id, action: 'doc.create', collection: 'customers', id: customer.id, ref: customer.name });
  return { id: customer.id, name: customer.name, company: customer.company ?? null, phone: customer.phone ?? null, email: customer.email, type: customer.type };
});

export const updateCustomerStaff = action(staffCustomer.and(z.object({ id: z.string().min(1).max(40) })), staffRoles, async ({ id, ...input }, { payload, user }) => {
  const customer = await updateCustomerByStaff(payload, id, input);
  await audit(payload, { user: user.id, action: 'doc.update', collection: 'customers', id, ref: customer.name });
  return { id };
});
