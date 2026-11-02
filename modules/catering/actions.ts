'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { clientIp, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { mailCatering } from './mail';
import { requestCatering as createRequest } from './service';

// Error messages are dictionary keys (`form.fields.*`), translated by ActionForm. No estimate field:
// the estimate is always computed on the server.
const schema = z.object({
  package: z.string().min(1, 'required'),
  guests: z.coerce.number('required').int('invalid').min(1, 'required').max(2000, 'invalid'),
  date: z.iso.date('required'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'required'),
  location: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  email: z.email('email'),
  phone: z.string().trim().min(5, 'required').max(40, 'tooLong'),
  notes: z.string().trim().max(2000, 'tooLong').optional(),
  locale: z.enum(LOCALES),
  website: z.string().optional(), // honeypot
});

export const requestCatering = publicAction(schema, async ({ website, ...input }, { payload }) => {
  const firstName = input.name.split(' ')[0];
  if (website) return { firstName, number: '' };
  await rateLimit(`catering:${await clientIp()}`, 5, 10 * 60_000);
  const { request, packageName } = await createRequest(payload, input);
  after(() => mailCatering(request, packageName, input.locale).catch((error) => console.error('[mail] catering', error)));
  return { firstName, number: request.number };
});
