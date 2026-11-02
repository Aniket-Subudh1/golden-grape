import type { Locale } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { mailContext } from '@/modules/notifications/context';
import { type CateringMail, CateringConfirmation, CateringStaff } from '@/modules/notifications/templates/catering';
import type { CateringRequest } from '@/payload-types';

/** Staff notification (French) and confirmation to the customer (their language). */
export async function mailCatering(request: CateringRequest, packageName: string, locale: Locale) {
  const ctx = await mailContext(locale);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const data = (l: Locale): CateringMail => ({
    number: request.number,
    packageName,
    guests: request.guests,
    date: new Date(request.date).toLocaleDateString(l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    time: request.time,
    location: request.location,
    name: request.contact.name,
    email: request.contact.email,
    phone: request.contact.phone,
    notes: request.notes ?? undefined,
    estimate: formatMoney(request.estimateCents, l),
    locale,
  });
  const [staff, confirmation] = await Promise.all([
    render(<CateringStaff t={ctx.staffT} data={data('fr')} {...shared} />),
    render(<CateringConfirmation t={ctx.customerT} data={data(locale)} {...shared} />),
  ]);
  const vars = (text: string) => text.replace('{{number}}', request.number).replace('{{name}}', request.contact.name);
  if (ctx.staffTo) {
    await sendMail({ to: ctx.staffTo, replyTo: request.contact.email, subject: vars(ctx.staffT.catering.staffSubject), ...staff });
  } else {
    console.warn('[mail] no MAIL_STAFF_TO or business e-mail: staff copy of a catering request not sent');
  }
  await sendMail({ to: request.contact.email, subject: vars(ctx.customerT.catering.confirmSubject), ...confirmation });
}
