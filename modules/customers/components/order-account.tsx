'use client';

import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionForm, SubmitButton, useFieldError } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import type { Dictionary, Locale } from '@/lib/i18n';
import { signUpFromOrderAction } from '../actions';

type Props = { id: string; token: string; locale: Locale; t: Dictionary['order']['account']; m: Dictionary['form']; errors: Record<string, string>; signInHref: string };

/** The account is already there: say so and offer to sign in (the e-mail comes from the order, it is not typed). */
function Exists({ t, href }: { t: Props['t']; href: string }) {
  if (!useFieldError('email')) return null;
  return (
    <p className="text-sm text-ink/70" role="alert">
      {t.exists}{' '}
      <Link href={href} className="border-b border-gold-deep text-gold-deep">
        {t.signIn}
      </Link>
    </p>
  );
}

/**
 * "Save my details" under a guest's confirmation (GG-010): one password and the order's name, e-mail, phone and
 * address become an account, signed in, with this order in it. Entirely optional; ordering never needs it.
 */
export function OrderAccount({ id, token, locale, t, m, errors, signInHref }: Props) {
  const router = useRouter();
  return (
    <section className="mt-12 border border-border/70 bg-champagne/30 p-6 md:p-8">
      <p className="eyebrow mb-3 flex items-center gap-2 text-gold-deep">
        <UserRound className="h-3.5 w-3.5" /> {t.title}
      </p>
      <p className="max-w-xl text-sm text-ink/70">{t.text}</p>
      <ActionForm
        action={signUpFromOrderAction}
        messages={{ ...m, success: t.done, fields: { ...m.fields, ...errors } }}
        onSuccess={() => router.refresh()}
        className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <Field name="password" type="password" label={t.password} autoComplete="new-password" minLength={8} required className="sm:w-72" />
        <SubmitButton label={t.submit} pendingLabel={t.sending} />
        <Exists t={t} href={signInHref} />
      </ActionForm>
      <p className="mt-4 text-xs text-ink/50">{t.note}</p>
    </section>
  );
}
