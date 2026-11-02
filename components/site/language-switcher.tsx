'use client';

import { Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Locale, LOCALES } from '@/lib/i18n';

const NAMES: Record<Locale, string> = { fr: 'Français', en: 'English', de: 'Deutsch', pt: 'Português' };

// `below-end` under the desktop nav; `above-start` at the bottom of the mobile menu.
type Props = { locale: Locale; label: string; tone?: 'dark' | 'light'; placement?: 'below-end' | 'above-start' };

/** Dropdown to the same path in another locale; remembers the choice in the NEXT_LOCALE cookie read by proxy.ts. */
export function LanguageSwitcher({ locale, label, tone = 'dark', placement = 'below-end' }: Props) {
  const rest = usePathname().split('/').slice(2).join('/');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label}: ${NAMES[locale]}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          'flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase transition-colors hover:text-gold',
          tone === 'light' && 'text-bone/80',
        )}
      >
        {locale}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      <ul
        id={menuId}
        hidden={!open}
        className={cn(
          'absolute z-10 min-w-44 border border-border bg-bone py-2 text-ink shadow-[var(--shadow-luxe)]',
          placement === 'below-end' ? 'top-full right-0 mt-3' : 'bottom-full left-0 mb-3',
        )}
      >
        {LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={`/${l}${rest ? `/${rest}` : ''}`}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? 'true' : undefined}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
                setOpen(false);
              }}
              className={cn(
                'flex items-center justify-between gap-4 px-4 py-2 text-sm font-light normal-case tracking-normal transition-colors hover:bg-champagne',
                l === locale && 'text-gold-deep',
              )}
            >
              <span>
                <span className="mr-3 text-[10px] tracking-[0.3em] uppercase opacity-60">{l}</span>
                {NAMES[l]}
              </span>
              {l === locale && <Check className="h-3.5 w-3.5" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
