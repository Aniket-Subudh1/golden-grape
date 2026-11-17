'use client';

import { Check, ChevronDown, Eye, EyeOff, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { type Locale, LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { staffSignInAction } from '@/modules/settings/actions';

type Texts = { email: string; password: string; submit: string; pending: string; show: string; hide: string };

/** Staff sign-in: on success, back to the screen that asked for it (`next`, always under /staff). */
export function LoginForm({ next, t, messages }: { next: string; t: Texts; messages: { error: string; fields: Record<string, string> } & Record<string, unknown> }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  return (
    <ActionForm
      action={staffSignInAction}
      messages={messages}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
      className="space-y-5"
    >
      <Field label={t.email} name="email" type="email" autoComplete="username" inputMode="email" required size="lg" look="box" />
      <Field
        label={t.password}
        name="password"
        type={shown ? 'text' : 'password'}
        autoComplete="current-password"
        required
        size="lg"
        look="box"
        trailing={
          <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? t.hide : t.show} aria-pressed={shown} className="grid h-9 w-9 place-items-center rounded-md text-ink/55 hover:text-ink">
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <SubmitButton label={t.submit} pendingLabel={t.pending} className="h-11 w-full rounded-md text-sm font-medium normal-case tracking-normal" />
    </ActionForm>
  );
}

/** Payload's own language cookie (one year, like Payload's). */
function rememberLanguage(code: Locale) {
  document.cookie = `payload-lng=${code}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The sign-in page's language (top right, as on the back office's sign-in). It shares the back office's language cookie
 * (`payload-lng`), so a choice made on either sign-in page holds on the other. Once signed in, the staff screens speak
 * the account's own language (Users › Language).
 */
export function LoginLanguage({ current, label }: { current: Locale; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const pick = (code: Locale) => {
    setOpen(false);
    if (code === current) return;
    rememberLanguage(code);
    router.refresh();
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-ink/12 bg-white px-3 text-[13px] font-medium shadow-[0_1px_2px_rgb(26_28_32/0.04)] hover:bg-champagne/50"
      >
        <Globe className="h-[15px] w-[15px] text-ink/55" aria-hidden />
        {LOCALE_NAMES[current]}
        <ChevronDown className="h-3 w-3 text-ink/55" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 rounded-xl border border-ink/10 bg-white p-1.5 shadow-lg">
          <p className="px-2.5 pb-1.5 pt-1 text-xs text-ink/55">{label}</p>
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === current}
              lang={code}
              onClick={() => pick(code)}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-champagne/50"
            >
              {LOCALE_NAMES[code]}
              {code === current && <Check className="h-4 w-4 text-gold-deep" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
