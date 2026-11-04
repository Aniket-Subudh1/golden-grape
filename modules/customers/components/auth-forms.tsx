'use client';

import { Building2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActionForm, FormDone, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { Dictionary, Locale } from '@/lib/i18n';
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from '../actions';

type T = Dictionary['auth'];
type Messages = Dictionary['form'];

/** After a successful sign-in, go on to the account (or where the visitor came from) and refresh the server parts. */
function GoTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
    router.refresh();
  }, [href, router]);
  return null;
}

const messages = (m: Messages, t: T) => ({ ...m, fields: { ...m.fields, ...t.errors } });

export function SignInForm({ t, m, next }: { t: T; m: Messages; next: string }) {
  return (
    <ActionForm action={signInAction} messages={{ ...messages(m, t), FORBIDDEN: t.errors.invalidLogin }} done={() => <GoTo href={next} />} className="space-y-6">
      <Field label={t.email} name="email" type="email" autoComplete="email" required size="lg" />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required size="lg" />
      <SubmitButton label={t.signIn} pendingLabel={t.pending} size="lg" className="w-full" />
    </ActionForm>
  );
}

export function SignUpForm({ t, m, locale, next }: { t: T; m: Messages; locale: Locale; next: string }) {
  const [type, setType] = useState<'private' | 'business'>('private');
  return (
    <ActionForm action={signUpAction} messages={messages(m, t)} done={() => <GoTo href={next} />} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.accountType}>
        {(['private', 'business'] as const).map((value) => {
          const Icon = value === 'private' ? UserRound : Building2;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={cn(
                'flex items-center gap-3 border px-4 py-3 text-left transition',
                type === value ? 'border-ink bg-champagne/50' : 'border-border hover:border-ink/40',
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', type === value ? 'text-gold-deep' : 'text-ink/40')} />
              <span>
                <span className="block text-sm">{t.types[value]}</span>
                <span className="block text-[11px] text-ink/50">{t.typeHints[value]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Field label={t.name} name="name" autoComplete="name" required size="lg" />
      {type === 'business' && (
        <div className="grid items-end gap-6 sm:grid-cols-2">
          <Field label={t.company} name="company" autoComplete="organization" required size="lg" />
          <Field label={t.vatNumber} name="vatNumber" placeholder="LU12345678" required size="lg" />
        </div>
      )}
      <div className="grid items-end gap-6 sm:grid-cols-2">
        <Field label={t.email} name="email" type="email" autoComplete="email" required size="lg" />
        <Field label={t.phoneOptional} name="phone" type="tel" autoComplete="tel" size="lg" />
      </div>
      <Field label={t.password} name="password" type="password" autoComplete="new-password" minLength={8} required size="lg" />
      <p className="-mt-4 text-[11px] text-ink/45">{t.passwordHint}</p>
      <label className="flex items-start gap-3 text-sm text-ink/70">
        <input type="checkbox" name="marketingConsent" className="mt-1 accent-gold-deep" />
        {t.marketing}
      </label>
      <SubmitButton label={t.signUp} pendingLabel={t.pending} size="lg" className="w-full" />
    </ActionForm>
  );
}

export function ForgotForm({ t, m }: { t: T; m: Messages }) {
  return (
    <ActionForm action={forgotPasswordAction} messages={messages(m, t)} done={() => <FormDone title={t.forgotSentTitle} subtitle={t.forgotSent} />} className="space-y-6">
      <Field label={t.email} name="email" type="email" autoComplete="email" required size="lg" />
      <SubmitButton label={t.sendLink} pendingLabel={t.pending} size="lg" className="w-full" />
    </ActionForm>
  );
}

export function ResetForm({ t, m, token, locale }: { t: T; m: Messages; token: string; locale: Locale }) {
  return (
    <ActionForm action={resetPasswordAction} messages={messages(m, t)} done={() => <GoTo href={`/${locale}/account`} />} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      <Field label={t.newPassword} name="password" type="password" autoComplete="new-password" minLength={8} required size="lg" />
      <Field label={t.confirmPassword} name="confirm" type="password" autoComplete="new-password" required size="lg" />
      <SubmitButton label={t.savePassword} pendingLabel={t.pending} size="lg" className="w-full" />
      <p className="text-center text-xs text-ink/50">
        <Link href={`/${locale}/auth?view=forgot`} className="hover:text-gold-deep">
          {t.newLink}
        </Link>
      </p>
    </ActionForm>
  );
}
