'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';

type Consent = 'essential' | 'analytics';
const COOKIE = 'gg_consent';

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => (document.cookie.match(/(?:^|; )gg_consent=(essential|analytics)/)?.[1] ?? null) as Consent | null;
// On the server the choice is unknown: render nothing, so the bar never flashes for returning visitors.
const unknown = () => 'unknown' as const;

function choose(value: Consent) {
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  listeners.forEach((listener) => listener());
}

/**
 * First-visit cookie bar. V1 loads no third-party script in either case (Q§12); a future analytics tag
 * (GA4) is rendered here only when the stored choice is 'analytics'.
 */
export function CookieConsent({ t }: { t: Dictionary['cookies'] }) {
  const consent = useSyncExternalStore(subscribe, read, unknown);
  if (consent !== null) return null;
  return (
    <div
      role="region"
      aria-label={t.label}
      className="animate-fade-up fixed right-3 bottom-3 left-3 z-40 border border-border bg-bone p-4 shadow-[var(--shadow-luxe)] md:right-6 md:bottom-6 md:left-auto md:max-w-sm md:p-5"
    >
      <p className="text-[11px] leading-relaxed font-light text-ink/70 md:text-xs">{t.text}</p>
      <div className="mt-3 flex flex-col gap-2 md:mt-4">
        <Button size="sm" onClick={() => choose('analytics')} className="h-9 w-full px-3 text-[10px] tracking-[0.2em]">
          {t.accept}
        </Button>
        <Button variant="outline" size="sm" onClick={() => choose('essential')} className="h-9 w-full px-3 text-[10px] tracking-[0.2em]">
          {t.essential}
        </Button>
      </div>
    </div>
  );
}
