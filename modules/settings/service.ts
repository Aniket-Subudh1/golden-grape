import { cacheTag } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { connection } from 'next/server';
import { createLocalReq, logoutOperation, type Payload } from 'payload';
import { AppError } from '@/lib/errors';
import { atRequest, getPayloadClient } from '@/lib/payload';
import type { User } from '@/payload-types';
import type { ModuleName } from './globals';

export { activeAccounts, type BankAccount, formatIban, transferAccount } from './iban';

/** Full settings, bank details included: for documents and e-mails only, never sent to a page. */
export async function getSettingsPrivate() {
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: 'BusinessSettings', overrideAccess: true });
}

/** Public projection for pages, cached until BusinessSettings changes. */
async function settingsCached() {
  'use cache';
  cacheTag('settings');
  const { business: b, hours, closedDates, modules } = await getSettingsPrivate();
  // Allow-list: a new private field (bank, internal e-mail) never reaches a page by default.
  const business = {
    name: b.name,
    legalName: b.legalName,
    street: b.street,
    postalCode: b.postalCode,
    city: b.city,
    country: b.country,
    phone: b.phone,
    email: b.email,
    vatNumber: b.vatNumber,
    rcs: b.rcs,
    mapsUrl: b.mapsUrl,
    instagram: b.instagram,
    facebook: b.facebook,
    latitude: b.latitude,
    longitude: b.longitude,
  };
  return { business, hours: hours ?? [], closedDates: closedDates ?? [], modules };
}

export const getSettings = atRequest(settingsCached);

export async function isModuleOn(name: ModuleName) {
  const { modules } = await getSettings();
  return modules?.[name] === true;
}

/**
 * The configured Google Maps link (the shop's own listing, exact), or a Maps search for the shop's name and address,
 * so Google opens the business rather than the bare address when it knows it (QA 14 Nov, GG-27).
 */
export const directionsUrl = (b: { mapsUrl?: string | null; name?: string | null; street: string; postalCode: string; city: string; country?: string | null }) =>
  b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name ? `${b.name}, ` : ''}${b.street}, ${b.postalCode} ${b.city}, ${b.country ?? 'Luxembourg'}`)}`;

// ---------------------------------------------------------------------------------------------------------------
// Staff sessions for the phone screens (/staff, M3.1 T1). The same Payload cookie as the admin: signing in on a phone
// also opens the admin, and the admin's session works on /staff.

const staffCookie = (payload: Payload) => `${payload.config.cookiePrefix}-token`;

/** Signs a staff member in with Payload's login (inactive accounts are refused by its beforeLogin hook). */
export async function staffSignIn(payload: Payload, email: string, password: string) {
  let result: Awaited<ReturnType<typeof payload.login<'users'>>>;
  try {
    result = await payload.login({ collection: 'users', data: { email: email.toLowerCase(), password }, overrideAccess: true });
  } catch {
    // Wrong password, unknown e-mail, a locked or disabled account: one answer, so e-mails cannot be probed.
    throw new AppError('FORBIDDEN', 'invalidLogin');
  }
  if (!result.token || !result.user?.roles?.length) throw new AppError('FORBIDDEN', 'invalidLogin');
  const auth = payload.collections.users.config.auth;
  const sameSite = typeof auth.cookies.sameSite === 'string' ? auth.cookies.sameSite : auth.cookies.sameSite ? 'Strict' : 'Lax';
  (await cookies()).set(staffCookie(payload), result.token, {
    httpOnly: true,
    path: '/',
    sameSite: sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
    secure: auth.cookies.secure || process.env.NODE_ENV === 'production',
    maxAge: auth.tokenExpiration,
    ...(auth.cookies.domain ? { domain: auth.cookies.domain } : {}),
  });
  return result.user;
}

/** Ends the staff session on the server too, then drops the cookie. */
export async function staffSignOut(payload: Payload) {
  const jar = await cookies();
  const { user } = await payload.auth({ headers: await headers() });
  if (user?.collection === 'users') await logoutOperation({ collection: payload.collections.users, req: await createLocalReq({ user }, payload) });
  jar.delete(staffCookie(payload));
}

/** The signed-in staff member (active, with at least one role), or null. Request-time only. */
export async function currentStaff(): Promise<User | null> {
  await connection();
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: await headers() });
  if (user?.collection !== 'users' || user.active === false || !user.roles?.length) return null;
  return user as User;
}
