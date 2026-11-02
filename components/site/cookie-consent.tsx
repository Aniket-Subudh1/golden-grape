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
    <div role="region" aria-label={t.label} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bone/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
        <p className="max-w-3xl text-sm leading-relaxed font-light text-ink/70">{t.text}</p>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => choose('essential')}>
            {t.essential}
          </Button>
          <Button size="sm" onClick={() => choose('analytics')}>
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
