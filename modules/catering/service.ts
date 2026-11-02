import { cacheTag } from 'next/cache';
import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { mulQty } from '@/lib/money';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { atRequest, getPayloadClient } from '@/lib/payload';
import { addDays, today } from '@/lib/time';
import { withTx } from '@/lib/tx';
import { getSettingsPrivate } from '@/modules/settings/service';

async function packagesCached(locale: Locale) {
  'use cache';
  cacheTag('catering');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({ collection: 'cateringPackages', locale, sort: 'order', limit: 20, depth: 1 });
  return docs;
}

export const listPackages = atRequest(packagesCached);

/** Earliest bookable date: today + 2 days in Luxembourg. */
export const earliestCateringDate = (now = new Date()) => addDays(today(now), 2);

export type CateringInput = {
  package: string;
  guests: number;
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  locale: Locale;
};

/**
 * Validates against the package, computes the estimate on the server (any client value is ignored) and
 * stores the request with the next gapless REQ number, in one transaction.
 */
export async function requestCatering(payload: Payload, input: CateringInput, now = new Date()) {
  const pkg = await payload.findByID({ collection: 'cateringPackages', id: input.package, locale: input.locale, depth: 0, disableErrors: true });
  if (!pkg) throw new AppError('VALIDATION', 'required', 'package');
  if (input.guests < pkg.minGuests) throw new AppError('VALIDATION', 'minGuests', 'guests');
  if (input.date < earliestCateringDate(now)) throw new AppError('VALIDATION', 'dateTooSoon', 'date');

  const { numbering } = await getSettingsPrivate();
  const year = Number(today(now).slice(0, 4));
  const request = await withTx(payload, async (tx) => {
    const n = await nextNumber(tx, 'cateringRequest', year);
    return payload.create({
      collection: 'cateringRequests',
      req: tx.req,
      overrideAccess: true,
      data: {
        number: formatNumber(numbering?.cateringRequest ?? 'REQ-{YYYY}-{0000}', year, n),
        status: 'new',
        package: pkg.id,
        guests: input.guests,
        date: `${input.date}T12:00:00.000Z`,
        time: input.time,
        location: input.location,
        contact: { name: input.name, email: input.email, phone: input.phone },
        notes: input.notes,
        estimateCents: mulQty(pkg.pricePerGuestCents, input.guests),
        locale: input.locale,
      },
    });
  });
  return { request, packageName: pkg.name };
}
