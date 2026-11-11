'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { QtyStepper } from '@/components/site/qty-stepper';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { isEmail, isPhone } from '@/lib/contact';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { bookEventAction } from '../actions';

type Props = {
  event: { id: string; title: string; when: string; priceCents: number };
  /** Seats still free; null = no limit. */
  left: number | null;
  locale: Locale;
  t: Dictionary['eventsPage'];
  form: Dictionary['form'];
  /** The checkout's "still missing" wording, so every booking form says it the same way (APPLUX audit 10 Nov, §14). */
  check: Pick<Dictionary['checkout'], 'missing' | 'check'>;
  labels: { minus: string; plus: string };
  className?: string;
};

/**
 * "Reserve" on an event (prototype ReserveDialog): guests, contact, an indicative total, booked without overbooking
 * by bookEventAction. A new booking key per opening, so a double click books once and a second visit books again.
 */
export function ReserveDialog({ event, left, locale, t, form, check, labels, className }: Props) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [guests, setGuests] = useState(2);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  // The same checks as the server and the checkout: the button works only when the booking can succeed (§14).
  const missing = [!contact.name.trim() && check.check.name, !isEmail(contact.email) && check.check.email, !isPhone(contact.phone.trim()) && check.check.phone].filter(
    (m): m is string => Boolean(m),
  );
  const d = t.dialog;
  const max = Math.min(20, left ?? 20);
  const soldOut = left !== null && left <= 0;

  return (
    <>
      <Button
        className={className}
        disabled={soldOut}
        onClick={() => {
          setKey(crypto.randomUUID());
          setGuests(Math.min(2, max));
          setContact({ name: '', email: '', phone: '' });
          setOpen(true);
        }}
      >
        {soldOut ? d.soldOut : t.reserve}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} label={d.title} closeLabel={d.close} variant="center">
        {open && (
          <ActionForm
            key={key}
            action={bookEventAction}
            messages={form}
            className="flex flex-col"
            done={(data) => (
              <div className="px-8 py-14 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/20">
                  <Check className="h-7 w-7 text-gold-deep" />
                </span>
                <h2 className="mt-6 font-serif text-3xl">{data.status === 'confirmed' ? d.doneConfirmed : d.donePending}</h2>
                <p className="mt-2 text-sm text-ink/60">{event.title} · {event.when}</p>
                <p className="mt-4 text-sm text-ink/60">{interpolate(d.doneText, { email: data.email })}</p>
                <Button variant="outline" className="mt-8" onClick={() => setOpen(false)}>
                  {d.close}
                </Button>
              </div>
            )}
          >
            <header className="border-b border-border/60 px-8 pt-8 pb-5 pr-16">
              <p className="eyebrow text-gold-deep">{event.when}</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight">{event.title}</h2>
            </header>
            <input type="hidden" name="idempotencyKey" value={key} />
            <input type="hidden" name="event" value={event.id} />
            <input type="hidden" name="guests" value={guests} />
            <input type="hidden" name="locale" value={locale} />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <div className="space-y-6 px-8 py-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="eyebrow text-ink/60">{d.guests}</span>
                <QtyStepper value={guests} onChange={setGuests} min={1} max={max} labels={labels} />
              </div>
              {left !== null && left <= 10 && <p className="text-xs text-gold-deep">{interpolate(left === 1 ? d.seatsLeft_one : d.seatsLeft_other, { count: left })}</p>}
              <Field
                name="name"
                label={`${d.name} *`}
                placeholder={d.namePh}
                autoComplete="name"
                required
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  name="email"
                  type="email"
                  label={`${d.email} *`}
                  placeholder={d.emailPh}
                  autoComplete="email"
                  required
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                />
                <Field
                  name="phone"
                  type="tel"
                  label={`${d.phone} *`}
                  placeholder={d.phonePh}
                  autoComplete="tel"
                  required
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
              <Field as="textarea" name="notes" label={d.comment} placeholder={d.commentPh} />
              {missing.length > 0 && <p className="text-xs text-ink/55">{interpolate(check.missing, { fields: missing.join(', ') })}</p>}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 bg-champagne/40 px-8 py-5">
              <div>
                <p className="eyebrow text-ink/50">{d.total}</p>
                <p className="font-serif text-2xl tabular-nums">{event.priceCents ? formatMoney(event.priceCents * guests, locale) : d.freeEntry}</p>
                {event.priceCents > 0 && <p className="text-[11px] text-ink/50">{d.payOnsite}</p>}
              </div>
              <SubmitButton label={d.submit} pendingLabel={d.sending} disabled={missing.length > 0} />
            </footer>
          </ActionForm>
        )}
      </Sheet>
    </>
  );
}
