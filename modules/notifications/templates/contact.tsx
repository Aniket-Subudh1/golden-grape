import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness } from './layout';

export type ContactMail = { name: string; email: string; phone?: string; subject: string; message: string; locale: string };

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: ContactMail };

/** To the team, in French (one shared staff inbox). */
export function ContactStaff({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(t.contact.staffSubject, { subject: data.subject, name: data.name })}</h1>
      <Details
        rows={[
          [t.labels.name, data.name],
          [t.labels.email, data.email],
          [t.labels.phone, data.phone || '—'],
          [t.labels.subject, data.subject],
          [t.labels.language, data.locale.toUpperCase()],
          [t.labels.message, data.message],
        ]}
      />
    </MailLayout>
  );
}

/** To the sender, in their language. */
export function ContactConfirmation({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{t.contact.confirmSubject}</h1>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{t.contact.confirmBody}</p>
      <Details rows={[[t.contact.yourMessage, data.message]]} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}
