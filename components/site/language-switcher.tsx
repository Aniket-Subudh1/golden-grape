'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { type Locale, LOCALES } from '@/lib/i18n';

const NAMES: Record<Locale, string> = { fr: 'Français', en: 'English', de: 'Deutsch', pt: 'Português' };

/** Same path in another locale; remembers the choice in the NEXT_LOCALE cookie read by proxy.ts. */
export function LanguageSwitcher({ locale, tone = 'dark' }: { locale: Locale; tone?: 'dark' | 'light' }) {
  const rest = usePathname().split('/').slice(2).join('/');
  return (
    <div className={cn('flex items-center gap-2 text-[10px] uppercase tracking-[0.3em]', tone === 'light' && 'text-bone/70')}>
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          <Link
            href={`/${l}${rest ? `/${rest}` : ''}`}
            hrefLang={l}
            lang={l}
            aria-label={NAMES[l]}
            aria-current={l === locale ? 'true' : undefined}
            onClick={() => {
              document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
            }}
            className={cn('transition-colors', l === locale ? 'text-gold' : 'opacity-70 hover:text-gold/80')}
          >
            {l.toUpperCase()}
          </Link>
          {i < LOCALES.length - 1 && <span className="opacity-30">·</span>}
        </span>
      ))}
    </div>
  );
}
