import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createLocalReq, logoutOperation, type Payload } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import type { Customer } from '@/payload-types';
import { normalizeVat } from './vat';

// Shop accounts. The session is Payload's customer token in our own cookie, so the website session never replaces
// a staff session (both would otherwise share Payload's single cookie name). Pages and actions get the customer
// from `currentCustomer()`, which verifies the token with Payload.

export const SESSION_COOKIE = 'gg_customer';
const MAX_AGE = 60 * 60 * 24 * 30; // matches customers `auth.tokenExpiration`

export type CustomerAddress = NonNullable<Customer['addresses']>[number];

async function setSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}

/** Ends the session on the server too (Payload keeps one per sign-in), so a copied token stops working. */
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (!token) return;
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) });
  if (user?.collection !== 'customers') return;
  await logoutOperation({ collection: payload.collections.customers, req: await createLocalReq({ user }, payload) });
}

/** The signed-in customer, verified by Payload; null for a guest or an expired session. */
export async function currentCustomer(): Promise<Customer | null> {
  await connection(); // request-time only: the session is never part of a prerendered page
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) });
  return user?.collection === 'customers' ? (user as Customer) : null;
}

/** A customer by id, for staff and services (02 §4). */
export async function getCustomer(payload: Payload, id: string) {
  return payload.findByID({ collection: 'customers', id, depth: 0, overrideAccess: true, disableErrors: true });
}

async function logIn(payload: Payload, email: string, password: string) {
  try {
    const result = await payload.login({ collection: 'customers', data: { email, password }, overrideAccess: true });
    if (!result.token) throw new AppError('FORBIDDEN', 'invalidLogin');
    await setSession(result.token);
    return result.user as Customer;
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Wrong password, unknown e-mail or a locked account: one answer, so e-mails cannot be probed.
    throw new AppError('FORBIDDEN', 'invalidLogin');
  }
}

export const signIn = (payload: Payload, input: { email: string; password: string }) => logIn(payload, input.email.toLowerCase(), input.password);

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  type: 'private' | 'business';
  company?: string;
  vatNumber?: string;
  marketingConsent: boolean;
  locale: Locale;
};

/** Creates a private or business account (only the listed fields: no group, terms or points) and signs it in. */
export async function signUp(payload: Payload, input: SignUpInput) {
  const email = input.email.toLowerCase();
  const { totalDocs } = await payload.count({ collection: 'customers', where: { email: { equals: email } }, overrideAccess: true });
  if (totalDocs > 0) throw new AppError('CONFLICT', 'emailTaken', 'email');
  await payload.create({
    collection: 'customers',
    overrideAccess: true,
    data: {
      name: input.name,
      email,
      password: input.password,
      phone: input.phone,
      type: input.type,
      company: input.type === 'business' ? input.company : undefined,
      vatNumber: input.type === 'business' && input.vatNumber ? normalizeVat(input.vatNumber) : undefined,
      marketingConsent: input.marketingConsent,
      locale: input.locale,
    },
  });
  return logIn(payload, email, input.password);
}

/** Sends the reset link when the e-mail has an account; says nothing either way. */
export async function forgotPassword(payload: Payload, email: string) {
  try {
    await payload.forgotPassword({ collection: 'customers', data: { email: email.toLowerCase() }, overrideAccess: true });
  } catch (error) {
    console.error('[customers] forgot password', error);
  }
}

/** Sets the new password from the e-mailed token and signs the customer in. */
export async function resetPassword(payload: Payload, input: { token: string; password: string }) {
  try {
    const { token, user } = await payload.resetPassword({ collection: 'customers', data: input, overrideAccess: true });
    if (token) await setSession(token);
    return user as unknown as Customer;
  } catch {
    throw new AppError('VALIDATION', 'resetExpired', 'password');
  }
}

export type ProfileInput = { name: string; phone?: string; locale: Locale; marketingConsent: boolean; company?: string; vatNumber?: string };

/** The customer's own profile: only these fields, never group, terms or points. */
export async function updateProfile(payload: Payload, customer: Customer, input: ProfileInput) {
  return payload.update({
    collection: 'customers',
    id: customer.id,
    overrideAccess: true,
    data: {
      name: input.name,
      phone: input.phone,
      locale: input.locale,
      marketingConsent: input.marketingConsent,
      ...(customer.type === 'business' ? { company: input.company, vatNumber: input.vatNumber ? normalizeVat(input.vatNumber) : undefined } : {}),
    },
  });
}

export async function changePassword(payload: Payload, customer: Customer, input: { current: string; password: string }) {
  try {
    await payload.login({ collection: 'customers', data: { email: customer.email, password: input.current }, overrideAccess: true });
  } catch {
    throw new AppError('VALIDATION', 'wrongPassword', 'current');
  }
  await payload.update({ collection: 'customers', id: customer.id, overrideAccess: true, data: { password: input.password } });
  return logIn(payload, customer.email, input.password);
}

export type AddressInput = { id?: string; label?: string; line1: string; line2?: string; postalCode: string; city: string; country: string; isDefault: boolean };

/** Adds or replaces one address. Exactly one address is the default: the first one, or the one marked. */
export async function saveAddress(payload: Payload, customer: Customer, input: AddressInput) {
  const rest = (customer.addresses ?? []).filter((a) => a.id !== input.id);
  if (input.id && rest.length === (customer.addresses ?? []).length) throw new AppError('NOT_FOUND', 'address');
  const address = { ...input, id: input.id };
  const all = [...rest, address];
  const defaultId = input.isDefault || !rest.some((a) => a.isDefault) ? address : null;
  return writeAddresses(payload, customer, all.map((a) => ({ ...a, isDefault: defaultId ? a === defaultId : Boolean(a.isDefault) })));
}

export async function deleteAddress(payload: Payload, customer: Customer, id: string) {
  const rest = (customer.addresses ?? []).filter((a) => a.id !== id);
  if (rest.length > 0 && !rest.some((a) => a.isDefault)) rest[0] = { ...rest[0], isDefault: true };
  return writeAddresses(payload, customer, rest);
}

export async function setDefaultAddress(payload: Payload, customer: Customer, id: string) {
  if (!(customer.addresses ?? []).some((a) => a.id === id)) throw new AppError('NOT_FOUND', 'address');
  return writeAddresses(payload, customer, (customer.addresses ?? []).map((a) => ({ ...a, isDefault: a.id === id })));
}

function writeAddresses(payload: Payload, customer: Customer, addresses: Partial<CustomerAddress>[]) {
  return payload.update({ collection: 'customers', id: customer.id, overrideAccess: true, data: { addresses: addresses as CustomerAddress[] } });
}
