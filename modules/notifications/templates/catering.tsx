import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness } from './layout';

export type CateringMail = {
  number: string;
  packageName: string;
  guests: number;
  date: string;
  time: string;
  location: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  estimate: string;
  locale: string;
};

type Props = { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: CateringMail };

const rows = (t: Dictionary['mail'], d: CateringMail): [string, string | number][] => [
  [t.labels.number, d.number],
  [t.labels.package, d.packageName],
  [t.labels.guests, d.guests],
  [t.labels.date, d.date],
  [t.labels.time, d.time],
  [t.labels.location, d.location],
  [t.labels.estimate, d.estimate],
];

export function CateringStaff({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(t.catering.staffSubject, { number: data.number, name: data.name })}</h1>
      <Details
        rows={[
          ...rows(t, data),
          [t.labels.name, data.name],
          [t.labels.email, data.email],
          [t.labels.phone, data.phone],
          [t.labels.language, data.locale.toUpperCase()],
          [t.labels.notes, data.notes || '—'],
        ]}
      />
    </MailLayout>
  );
}

export function CateringConfirmation({ t, business, logoUrl, data }: Props) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{interpolate(t.catering.confirmSubject, { number: data.number })}</h1>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{t.catering.confirmBody}</p>
      <Details rows={rows(t, data)} />
      <p style={{ fontSize: 13, color: '#6b6257' }}>{t.catering.estimateNote}</p>
      <p>{t.signature}</p>
    </MailLayout>
  );
}
