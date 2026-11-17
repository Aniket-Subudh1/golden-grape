'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { type Locale, LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { setStaffLanguage } from '@/modules/settings/actions';

/** Payload's own language cookie (one year, like Payload's): the back office follows the same choice. */
function rememberLanguage(code: Locale) {
  document.cookie = `payload-lng=${code}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The language menu of the staff screens. On the sign-in page it sets the back office's cookie (`payload-lng`); once
 * signed in (`account`) it also saves the language on the staff member's account, which the staff screens speak.
 * `place`: `down` under a top-right button, `up` above the sidebar's foot (the icon rail shows the code only).
 */
export function LanguageMenu({
  current,
  label,
  account = false,
  place = 'down',
  tone = 'light',
}: {
  current: Locale;
  label: string;
  account?: boolean;
  place?: 'down' | 'up';
  /** `dark`: on the phone's dark app bar. */
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
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
  const pick = (code: Locale) =>
    start(async () => {
      setOpen(false);
      if (code === current) return;
      rememberLanguage(code);
      if (account) await setStaffLanguage(null, { locale: code });
      router.refresh();
    });
  const up = place === 'up';
  return (
    <div ref={ref} className={cn('relative', up && 'w-full')}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${LOCALE_NAMES[current]}`}
        title={label}
        disabled={pending}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium transition disabled:opacity-60',
          tone === 'dark'
            ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
            : 'border-ink/12 hover:bg-champagne/50 bg-white shadow-[0_1px_2px_rgb(26_28_32/0.04)]',
          up && 'w-full justify-center px-2 lg:justify-start lg:px-3',
        )}
      >
        <Globe className={cn('h-[15px] w-[15px] shrink-0', tone === 'dark' ? 'text-gold' : 'text-ink/55')} aria-hidden />
        {up ? (
          <>
            <span className="uppercase lg:hidden">{current}</span>
            <span className="hidden flex-1 text-left lg:inline">{LOCALE_NAMES[current]}</span>
          </>
        ) : (
          <span className={tone === 'dark' ? 'uppercase' : undefined}>{tone === 'dark' ? current : LOCALE_NAMES[current]}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 shrink-0', tone === 'dark' ? 'text-white/60' : 'text-ink/55', up && 'hidden lg:block')} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'border-ink/10 text-ink absolute z-50 w-52 rounded-xl border bg-white p-1.5 shadow-lg',
            up ? 'bottom-[calc(100%+8px)] left-0' : 'top-[calc(100%+8px)] right-0',
          )}
        >
          <p className="text-ink/55 px-2.5 pt-1 pb-1.5 text-xs">{label}</p>
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === current}
              lang={code}
              onClick={() => pick(code)}
              className="hover:bg-champagne/50 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm"
            >
              {LOCALE_NAMES[code]}
              {code === current && <Check className="text-gold-deep h-4 w-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
