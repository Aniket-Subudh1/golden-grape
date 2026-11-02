'use client';

import { useState } from 'react';
import { ActionForm, FormDone, SubmitButton } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { sendContact } from '../actions';

const SUBJECTS = ['boutique', 'traiteur', 'evenement', 'autre'] as const;

export function ContactForm({ t, form, locale }: { t: Dictionary['contactPage']['form']; form: Dictionary['form']; locale: Locale }) {
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('boutique');
  return (
    <ActionForm
      action={sendContact}
      messages={form}
      done={(data) => <FormDone title={interpolate(t.doneTitle, { name: data.firstName })} subtitle={t.doneSubtitle} />}
      className="space-y-6"
    >
      <div>
        <p className="eyebrow mb-2 text-gold-deep">{t.eyebrow}</p>
        <h2 className="font-serif text-3xl font-light md:text-4xl">{t.title}</h2>
      </div>
      <fieldset>
        <legend className="eyebrow mb-2 block text-ink/60">{t.subject}</legend>
        <input type="hidden" name="subject" value={subject} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SUBJECTS.map((id) => (
            <Button
              key={id}
              type="button"
              variant="chip"
              active={subject === id}
              aria-pressed={subject === id}
              onClick={() => setSubject(id)}
              className="h-10 px-2 text-[10px]"
            >
              {t.subjects[id]}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field size="lg" label={t.name} name="name" placeholder={t.namePh} autoComplete="name" required />
        <Field size="lg" label={t.phone} name="phone" type="tel" placeholder={t.phonePh} autoComplete="tel" />
      </div>
      <Field size="lg" label={t.email} name="email" type="email" placeholder={t.emailPh} autoComplete="email" required />
      <Field size="lg" as="textarea" label={t.message} name="message" placeholder={t.messagePh} rows={5} required />
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden="true" className="hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton label={t.submit} pendingLabel={t.sending} size="lg" className="w-full" />
    </ActionForm>
  );
}
