import { appUrl } from '@/lib/env';
import { isLocale, localePath } from '@/lib/i18n';
import { render } from '@/lib/mail';
import { mailContext } from '@/modules/notifications/context';
import { ResetPassword } from '@/modules/notifications/templates/reset-password';

/** Subject and HTML of the password-reset e-mail Payload sends (customers `auth.forgotPassword`), in the customer's language. */
export async function resetPasswordMail(user: { name?: string; locale?: string } | undefined, token: string) {
  const locale = isLocale(user?.locale) ? user.locale : 'fr';
  const { business, customerT, logoUrl } = await mailContext(locale);
  const url = `${appUrl()}${localePath(locale, '/auth/reset')}?token=${encodeURIComponent(token)}`;
  const { html } = await render(<ResetPassword t={customerT} business={business} logoUrl={logoUrl} name={user?.name ?? ''} url={url} />);
  return { subject: customerT.reset.subject, html };
}
