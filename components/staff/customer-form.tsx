'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { createCustomerStaff, updateCustomerStaff } from '@/modules/customers/actions';

export type CustomerTexts = {
  name: string;
  phone: string;
  email: string;
  emailHint: string;
  type: string;
  private: string;
  business: string;
  company: string;
  vatNumber: string;
  language: string;
  create: string;
  save: string;
  pending: string;
  saved: string;
};

export type PickedCustomer = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string;
  type: 'private' | 'business';
};
type Initial = {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: 'private' | 'business';
  company: string;
  vatNumber: string;
  locale: string;
};

/** Create a customer at the till, or edit one (M3.1 T5). Name and phone are enough; the e-mail is optional (A-16). */
export function CustomerForm({
  t,
  messages,
  initial,
  onDone,
}: {
  t: CustomerTexts;
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
  initial?: Initial;
  onDone: (customer: PickedCustomer | { id: string }) => void;
}) {
  const [type, setType] = useState<'private' | 'business'>(initial?.type ?? 'private');
  return (
    <ActionForm
      action={initial ? updateCustomerStaff : createCustomerStaff}
      messages={{ ...messages, success: initial ? t.saved : undefined }}
      onSuccess={onDone}
      keepValues={Boolean(initial)}
      className="space-y-4"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field look="box" label={t.name} name="name" defaultValue={initial?.name} required autoComplete="off" />
      <Field
        look="box"
        label={t.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={initial?.phone}
        required
        autoComplete="off"
      />
      <Field
        look="box"
        label={t.email}
        name="email"
        type="email"
        inputMode="email"
        hint={t.emailHint}
        defaultValue={initial?.email}
        autoComplete="off"
      />
      <fieldset>
        <legend className="text-ink/80 mb-2 text-sm font-medium">{t.type}</legend>
        <div className="flex gap-2">
          {(['private', 'business'] as const).map((value) => (
            <label
              key={value}
              className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium ${type === value ? 'border-ink bg-ink text-bone' : 'border-border bg-white'}`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {t[value]}
            </label>
          ))}
        </div>
      </fieldset>
      {type === 'business' && (
        <>
          <Field look="box" label={t.company} name="company" defaultValue={initial?.company} required />
          <Field
            look="box"
            label={t.vatNumber}
            name="vatNumber"
            defaultValue={initial?.vatNumber}
            placeholder="LU12345678"
          />
        </>
      )}
      <Field look="box" label={t.language} name="locale" as="select" defaultValue={initial?.locale ?? 'fr'}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </Field>
      <SubmitButton label={initial ? t.save : t.create} pendingLabel={t.pending} className="w-full" />
    </ActionForm>
  );
}
