import { appUrl, env } from '@/lib/env';
import { getDictionary, type Locale } from '@/lib/i18n';
import { getSettingsPrivate } from '@/modules/settings/service';

/** What every request e-mail needs: staff texts (French), the customer's texts, business footer, logo, inbox. */
export async function mailContext(locale: Locale) {
  const [{ business }, staff, customer] = await Promise.all([getSettingsPrivate(), getDictionary('fr'), getDictionary(locale)]);
  return {
    business,
    staffT: staff.mail,
    customerT: customer.mail,
    logoUrl: `${appUrl()}/brand/logo-light.png`,
    staffTo: env.MAIL_STAFF_TO ?? business.email ?? undefined,
  };
}
