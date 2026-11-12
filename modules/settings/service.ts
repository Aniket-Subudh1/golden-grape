import { cacheTag } from 'next/cache';
import { atRequest, getPayloadClient } from '@/lib/payload';
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

/** The configured Google Maps link, or a Maps search for the address. */
export const directionsUrl = (b: { mapsUrl?: string | null; street: string; postalCode: string; city: string; country?: string | null }) =>
  b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.street}, ${b.postalCode} ${b.city}, ${b.country ?? 'Luxembourg'}`)}`;
