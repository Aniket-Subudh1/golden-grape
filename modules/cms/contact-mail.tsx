import { getDictionary, type Locale } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { mailContext } from '@/modules/notifications/context';
import { ContactConfirmation, ContactStaff } from '@/modules/notifications/templates/contact';

type Contact = { name: string; email: string; phone?: string; subject: 'boutique' | 'traiteur' | 'evenement' | 'autre'; message: string; locale: Locale };

/** Staff notification (French) and confirmation to the sender (their language). Nothing is stored. */
export async function mailContact(input: Contact) {
  const [ctx, fr, customer] = await Promise.all([mailContext(input.locale), getDictionary('fr'), getDictionary(input.locale)]);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const staffData = { ...input, subject: fr.contactPage.form.subjects[input.subject] };
  const customerData = { ...input, subject: customer.contactPage.form.subjects[input.subject] };
  const [staff, confirmation] = await Promise.all([
    render(<ContactStaff t={ctx.staffT} data={staffData} {...shared} />),
    render(<ContactConfirmation t={ctx.customerT} data={customerData} {...shared} />),
  ]);
  if (ctx.staffTo) {
    await sendMail({ to: ctx.staffTo, replyTo: input.email, subject: `${ctx.staffT.contact.staffSubject.replace('{{subject}}', staffData.subject).replace('{{name}}', input.name)}`, ...staff });
  } else {
    console.warn('[mail] no MAIL_STAFF_TO or business e-mail: staff copy of a contact message not sent');
  }
  await sendMail({ to: input.email, subject: ctx.customerT.contact.confirmSubject, ...confirmation });
}
