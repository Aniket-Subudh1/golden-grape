import { type Locale, interpolate } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { mailContext } from '@/modules/notifications/context';
import { type EventBookingMail, EventBookingCustomer, EventBookingStaff } from '@/modules/notifications/templates/event-booking';
import type { Event, EventBooking } from '@/payload-types';

/**
 * The booking to the customer (their language) and, for a new booking, a copy to staff (French). `payment`: the
 * separate e-mail sent when staff record the payment (APPLUX audit 10 Nov, §7): payment received, booking confirmed.
 */
export async function mailEventBooking(booking: EventBooking, eventIn: { fr: Event; customer: Event }, { staff, payment = false }: { staff: boolean; payment?: boolean }) {
  const locale = (booking.locale ?? 'fr') as Locale;
  const ctx = await mailContext(locale);
  const shared = { business: ctx.business, logoUrl: ctx.logoUrl };
  const data = (event: Event, l: Locale): EventBookingMail => {
    const when = eventDate(event.startsAt, event.endsAt, l);
    return {
      title: event.title,
      date: `${when.date} · ${when.time}`,
      name: booking.contact?.name ?? '',
      email: booking.contact?.email ?? '',
      phone: booking.contact?.phone ?? '',
      locale,
      guests: booking.guests ?? 1,
      amount: booking.amountCents ? formatMoney(booking.amountCents, l) : null,
      status: booking.status ?? 'pending',
      notes: booking.notes,
      payment:
        payment && booking.payment?.amountCents
          ? {
              amount: formatMoney(booking.payment.amountCents, l),
              on: new Intl.DateTimeFormat(l, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(booking.payment.at ?? Date.now())),
            }
          : null,
    };
  };
  const customer = data(eventIn.customer, locale);
  const t = ctx.customerT.eventBooking;
  const sends = [
    render(<EventBookingCustomer t={ctx.customerT} data={customer} {...shared} />).then((html) =>
      sendMail({
        to: customer.email,
        subject: interpolate(customer.payment ? t.paymentSubject : customer.status === 'cancelled' ? t.cancelledSubject : t.subject, { title: customer.title }),
        ...html,
      }),
    ),
  ];
  if (staff && ctx.staffTo) {
    const copy = data(eventIn.fr, 'fr');
    sends.push(
      render(<EventBookingStaff t={ctx.staffT} data={copy} {...shared} />).then((html) =>
        sendMail({ to: ctx.staffTo!, replyTo: copy.email, subject: interpolate(ctx.staffT.eventBooking.staffSubject, { title: copy.title, name: copy.name, guests: copy.guests }), ...html }),
      ),
    );
  }
  await Promise.all(sends);
}
