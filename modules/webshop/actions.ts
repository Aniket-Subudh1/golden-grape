'use server';

import { z } from 'zod';
import { clientIp, publicAction } from '@/lib/action';
import { rateLimit } from '@/lib/rate-limit';
import { LOCALES } from '@/lib/i18n';
import { currentCustomer } from '@/modules/customers/service';
import { quoteCart } from '@/modules/promotions/service';
import { addressSuggestions, localityFor } from './service';

// The cart's only source of numbers: prices, totals, VAT and what is in stock all come from the server quote.
export const quoteCartAction = publicAction(
  z.object({
    locale: z.enum(LOCALES),
    lines: z
      .array(z.object({ variant: z.string().min(1).max(40), unit: z.string().min(1).max(40).optional(), qty: z.number().int().min(1).max(999) }))
      .max(60),
  }),
  async (input, { payload }) => quoteCart(payload, input.lines, { customer: await currentCustomer(), channel: 'webshop', locale: input.locale }),
);

/** Address suggestions while the customer types the street (GG-007); 60 searches a minute per address is plenty. */
export const suggestAddressAction = publicAction(z.object({ query: z.string().max(120) }), async ({ query }) => {
  await rateLimit(`address:${await clientIp()}`, 60, 60_000);
  return addressSuggestions(query);
});

/** The locality of a postcode, to fill the town field (the customer can change it). */
export const localityAction = publicAction(z.object({ postalCode: z.string().max(12) }), async ({ postalCode }) => {
  await rateLimit(`address:${await clientIp()}`, 60, 60_000);
  return localityFor(postalCode);
});
