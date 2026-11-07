import { appUrl } from '@/lib/env';
import { isLocale, type Locale, localePath } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { mailContext } from '@/modules/notifications/context';
import { ResetPassword } from '@/modules/notifications/templates/reset-password';
import { Welcome } from '@/modules/notifications/templates/welcome';

/** Subject and HTML of the password-reset e-mail Payload sends (customers `auth.forgotPassword`), in the customer's language. */
export async function resetPasswordMail(user: { name?: string; locale?: string } | undefined, token: string) {
  const locale = isLocale(user?.locale) ? user.locale : 'fr';
  const { business, customerT, logoUrl } = await mailContext(locale);
  const url = `${appUrl()}${localePath(locale, '/auth/reset')}?token=${encodeURIComponent(token)}`;
  const { html } = await render(<ResetPassword t={customerT} business={business} logoUrl={logoUrl} name={user?.name ?? ''} url={url} />);
  return { subject: customerT.reset.subject, html };
}

/** "Your account has been created" (GG-012): only called after an account was actually created, never for a guest order. */
export async function mailWelcome(customer: { name: string; email: string; locale?: string | null }) {
  const locale: Locale = isLocale(customer.locale ?? undefined) ? (customer.locale as Locale) : 'fr';
  const { business, customerT, logoUrl } = await mailContext(locale);
  const url = `${appUrl()}${localePath(locale, '/account')}`;
  const mail = await render(<Welcome t={customerT} business={business} logoUrl={logoUrl} name={customer.name} email={customer.email} url={url} />);
  await sendMail({ to: customer.email, subject: customerT.welcome.subject, ...mail });
}
