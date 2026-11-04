'use server';

import { z } from 'zod';
import { publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { currentCustomer } from '@/modules/customers/service';
import { quoteCart } from '@/modules/promotions/service';

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
