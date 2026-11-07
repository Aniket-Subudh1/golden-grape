'use client';

import { Check, Info } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { ActionForm, FormDone, SubmitButton, useFieldError } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { formatMoney, mulQty } from '@/lib/money';
import { requestCatering } from '../actions';

export type PackageCard = {
  id: string;
  name: string;
  tagline?: string | null;
  includes: string[];
  pricePerGuestCents: number;
  minGuests: number;
  image?: string | null;
};

type Props = { t: Dictionary['cateringPage']; form: Dictionary['form']; locale: Locale; packages: PackageCard[]; minDate: string };

function PackageError() {
  const error = useFieldError('package');
  return error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null;
}

export function CateringForm({ t, form, locale, packages, minDate }: Props) {
  const [selected, setSelected] = useState<string>();
  const [guests, setGuests] = useState(20);
  const pkg = packages.find((p) => p.id === selected);
  const r = t.request;

  return (
    <ActionForm
      action={requestCatering}
      messages={form}
      done={(data) => (
        <div id="catering-done" className="scroll-mt-32">
          <FormDone title={interpolate(r.doneTitle, { name: data.firstName })} subtitle={r.doneSubtitle} />
        </div>
      )}
      // GG-034: the thank-you replaces a long form; bring it into view instead of leaving the page at the bottom.
      onSuccess={() => document.getElementById('catering-done')?.scrollIntoView({ block: 'start' })}
    >
      <section id="packages" className="scroll-mt-32 pb-16">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-6 md:grid-cols-3 md:px-10">
          {packages.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(p.id)}
                className={cn(
                  'group relative flex flex-col overflow-hidden border bg-bone text-left transition-all',
                  active ? '-translate-y-1 border-gold-deep shadow-2xl ring-2 shadow-ink/10 ring-gold-deep' : 'border-border hover:border-ink/40',
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-ink">
                  {p.image && (
                    <Image src={p.image} alt={p.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-[1400ms] group-hover:scale-105" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-3xl font-light">{p.name}</h3>
                      {p.tagline && <p className="mt-1 text-sm text-ink/60 italic">{p.tagline}</p>}
                    </div>
                    {active && (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-deep text-bone">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <p className="mt-6 font-serif text-2xl">
                    {formatMoney(p.pricePerGuestCents, locale, { compact: true })} <span className="font-sans text-sm text-ink/50">{t.perGuest}</span>
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm font-light text-ink/70">
                    {p.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-gold-deep">—</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  {/* GG-032: what clicking does, and which one is chosen, said in words (the whole card stays clickable). */}
                  <span
                    className={cn(
                      'mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full border text-[11px] tracking-[0.25em] uppercase transition',
                      active ? 'border-gold-deep bg-gold-deep text-bone' : 'border-ink text-ink group-hover:bg-ink group-hover:text-bone',
                    )}
                  >
                    {active && <Check className="h-4 w-4" />}
                    {active ? r.selected : r.select}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="request" className="px-6 pb-32 md:px-10">
        <div className="mx-auto max-w-[900px] space-y-8 border border-border bg-champagne/50 p-8 md:p-14">
          <div>
            <p className="eyebrow mb-3 text-gold-deep">{r.eyebrow}</p>
            <h2 className="font-serif text-4xl font-light md:text-5xl">{r.title}</h2>
            <p className="mt-4 text-sm">
              {pkg ? (
                <>
                  <b className="font-medium">{interpolate(r.chosen, { name: pkg.name })}</b>{' '}
                  <a href="#packages" className="ml-2 border-b border-gold-deep text-gold-deep">
                    {r.change}
                  </a>
                </>
              ) : (
                <a href="#packages" className="border-b border-gold-deep text-gold-deep">
                  {r.choose}
                </a>
              )}
            </p>
            <input type="hidden" name="package" value={selected ?? ''} />
            <PackageError />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field
              size="lg"
              label={r.guests}
              name="guests"
              type="number"
              min={pkg?.minGuests ?? 1}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value) || 0)}
              required
            />
            <Field size="lg" label={r.location} name="location" placeholder={r.locationPh} required />
            <Field size="lg" label={r.date} name="date" type="date" min={minDate} required />
            <Field size="lg" label={r.time} name="time" type="time" required />
            <Field size="lg" label={r.name} name="name" placeholder={r.namePh} autoComplete="name" required />
            <Field size="lg" label={r.phone} name="phone" type="tel" placeholder={r.phonePh} autoComplete="tel" required />
          </div>
          <Field size="lg" label={r.email} name="email" type="email" placeholder={r.emailPh} autoComplete="email" required />
          <Field size="lg" label={r.comment} name="notes" placeholder={r.commentPh} />
          <input type="hidden" name="locale" value={locale} />
          <div aria-hidden="true" className="hidden">
            <input name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-6 border-t border-border pt-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow mb-1 text-ink/50">{r.estimate}</p>
              {/* Display only: the stored estimate is recomputed on the server. */}
              <p className="font-serif text-4xl tabular-nums">{pkg ? formatMoney(mulQty(pkg.pricePerGuestCents, guests), locale, { compact: true }) : '—'}</p>
              {/* GG-035: an estimate, not a price: the final price comes with the personalised quotation. */}
              <p className="mt-2 flex max-w-md items-start gap-2 text-xs leading-relaxed text-ink/60">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                {pkg
                  ? interpolate(r.estimateNote, { price: formatMoney(pkg.pricePerGuestCents, locale, { compact: true }), count: guests })
                  : r.selectHint}
              </p>
            </div>
            <SubmitButton label={r.submit} pendingLabel={r.sending} size="lg" className="px-10" />
          </div>
        </div>
      </section>
    </ActionForm>
  );
}
