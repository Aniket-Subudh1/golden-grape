import { type Dictionary, interpolate } from '@/lib/i18n';
import { heading, MailLayout, type MailBusiness } from './layout';
import { ViewButton } from './order-received';

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; name: string; email: string; url: string };

/** Sent once, when a shop account has really been created (sign-up, or "save my details" after an order). GG-012. */
export function Welcome({ t, business, logoUrl, name, email, url }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{t.welcome.title}</h1>
      <p>{interpolate(t.greeting, { name })}</p>
      <p>{interpolate(t.welcome.body, { email })}</p>
      <ViewButton href={url} label={t.welcome.button} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}
