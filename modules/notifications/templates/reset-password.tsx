import { type Dictionary, interpolate } from '@/lib/i18n';
import { colors, heading, MailLayout, type MailBusiness } from './layout';

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; name: string; url: string };

/** "Choose a new password" link for a shop account, in the customer's language. */
export function ResetPassword({ t, business, logoUrl, name, url }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{t.reset.subject}</h1>
      <p>{interpolate(t.greeting, { name })}</p>
      <p>{t.reset.body}</p>
      <p style={{ margin: '28px 0' }}>
        <a href={url} style={{ display: 'inline-block', padding: '14px 28px', background: colors.ink, color: colors.bone, textDecoration: 'none', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>
          {t.reset.button}
        </a>
      </p>
      <p style={{ fontSize: 13, color: colors.muted }}>{t.reset.ignore}</p>
      <p>{t.signature}</p>
    </MailLayout>
  );
}
