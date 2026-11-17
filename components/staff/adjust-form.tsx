'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { adjustStock } from '@/modules/inventory/actions';
import { done } from './feedback';

type Texts = {
  title: string;
  qty: string;
  qtyHint: string;
  reason: string;
  note: string;
  submit: string;
  pending: string;
  done: string;
};

/** A stock correction from the phone: the same action as the admin's "Corriger le stock" (M2.1), never below zero. */
export function AdjustForm({
  variant,
  reasons,
  t,
  messages,
}: {
  variant: string;
  reasons: { value: string; label: string }[];
  t: Texts;
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0]?.value ?? 'other');
  return (
    <ActionForm
      action={adjustStock}
      messages={{ ...messages, success: t.done }}
      onSuccess={() => {
        done();
        router.refresh();
      }}
      className="gg-card space-y-5 p-4"
    >
      <h2 className="font-serif text-xl">{t.title}</h2>
      <input type="hidden" name="variant" value={variant} />
      <Field
        look="box"
        label={t.qty}
        hint={t.qtyHint}
        name="qty"
        type="text"
        inputMode="numeric"
        pattern="-?[0-9]*"
        required
      />
      <Field
        look="box"
        label={t.reason}
        name="reason"
        as="select"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      >
        {reasons.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Field>
      {reason === 'other' && <Field look="box" label={t.note} name="note" required />}
      <SubmitButton label={t.submit} pendingLabel={t.pending} className="w-full" />
    </ActionForm>
  );
}
