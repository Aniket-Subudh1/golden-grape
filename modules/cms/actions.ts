'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { clientIp, optionalPhoneField, publicAction } from '@/lib/action';
import { LOCALES } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { mailContact } from './contact-mail';

// Error messages are dictionary keys (`form.fields.*`), translated by ActionForm.
const schema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  email: z.email('email'),
  phone: optionalPhoneField,
  subject: z.enum(['boutique', 'traiteur', 'evenement', 'autre'], 'invalid'),
  message: z.string().trim().min(10, 'tooShort').max(4000, 'tooLong'),
  locale: z.enum(LOCALES),
  website: z.string().optional(), // honeypot: real visitors never see or fill it
});

export const sendContact = publicAction(schema, async ({ website, ...input }) => {
  const firstName = input.name.split(' ')[0];
  if (website) return { firstName }; // a bot: pretend it worked, send nothing
  await rateLimit(`contact:${await clientIp()}`, 5, 10 * 60_000);
  // After the response: a slow SMTP server never blocks the visitor; failures are only logged.
  after(() => mailContact(input).catch((error) => console.error('[mail] contact', error)));
  return { firstName };
});
