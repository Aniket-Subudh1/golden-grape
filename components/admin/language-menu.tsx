'use client';

import { useTranslation } from '@payloadcms/ui';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { adminText, type AdminLanguage, LANGUAGE_NAMES } from './text';

/**
 * The language of the admin itself (not of the website text): on the login page and in the header (Payload
 * `admin.components.actions`). The choice is remembered per browser by Payload's language cookie.
 */
export default function LanguageMenu() {
  const { i18n, switchLanguage } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = i18n.language as AdminLanguage;
  const label = adminText(current).language;

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

  return (
    <div className="gg-menu" ref={ref}>
      <button type="button" className="gg-menu__button" aria-haspopup="menu" aria-expanded={open} title={label} onClick={() => setOpen(!open)}>
        <Globe aria-hidden="true" />
        <span>{LANGUAGE_NAMES[current] ?? current}</span>
        <ChevronDown aria-hidden="true" className="gg-menu__chevron" />
      </button>
      {open && (
        <div className="gg-menu__list" role="menu" aria-label={label}>
          <p className="gg-menu__title">{label}</p>
          {(Object.keys(LANGUAGE_NAMES) as AdminLanguage[]).map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === current}
              lang={code}
              className="gg-menu__item"
              onClick={async () => {
                setOpen(false);
                if (code === current) return;
                await switchLanguage?.(code);
                router.refresh();
              }}
            >
              {LANGUAGE_NAMES[code]}
              {code === current && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
