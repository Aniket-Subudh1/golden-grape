'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import type { Dictionary } from '@/lib/i18n';
import { acceptQuotationAction, declineQuotationAction } from '../actions';

type Props = { quotation: string; token: string; t: Dictionary['documents']['view']; form: Dictionary['form'] };

/**
 * Accept and sign (typed full name + consent), or decline, on the customer's page of a quotation. The page is drawn
 * again after either: it then shows the signed or declined state. A quotation that changed meanwhile (expired, signed in
 * another tab) is said so, then the page refreshes.
 */
export function QuotationDecision({ quotation, token, t, form }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const messages = { ...form, CONFLICT: form.fields.notAcceptable };
  const refreshing =
    <A extends (prev: unknown, data: FormData) => Promise<{ ok: boolean; error?: string }>>(run: A) =>
    async (prev: unknown, data: FormData) => {
      const result = await run(prev, data);
      if (!result.ok && result.error === 'CONFLICT') window.setTimeout(() => router.refresh(), 1500);
      return result;
    };

  return (
    <div className="space-y-10">
      <ActionForm action={refreshing(acceptQuotationAction) as typeof acceptQuotationAction} messages={messages} onSuccess={() => router.refresh()} keepValues className="space-y-5">
        <input type="hidden" name="quotation" value={quotation} />
        <input type="hidden" name="token" value={token} />
        <h2 className="font-serif text-3xl">{t.acceptTitle}</h2>
        <p className="text-sm leading-relaxed text-ink/60">{t.acceptText}</p>
        <Field size="lg" name="name" label={`${t.nameLabel} *`} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/80">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold-deep)]" required />
          <span>{t.consent}</span>
        </label>
        <SubmitButton label={t.accept} pendingLabel={t.signing} size="lg" className="w-full" disabled={name.trim().length < 3 || !consent} />
      </ActionForm>

      <ActionForm action={refreshing(declineQuotationAction) as typeof declineQuotationAction} messages={messages} onSuccess={() => router.refresh()} className="space-y-4 border-t border-border/70 pt-8">
        <input type="hidden" name="quotation" value={quotation} />
        <input type="hidden" name="token" value={token} />
        <p className="eyebrow text-ink/60">{t.declineTitle}</p>
        <Field as="textarea" name="reason" label={t.declineReason} rows={2} />
        <SubmitButton label={t.decline} pendingLabel={t.declining} variant="outline" />
      </ActionForm>
    </div>
  );
}
