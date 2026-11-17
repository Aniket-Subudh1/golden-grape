'use client';

import { Gift } from 'lucide-react';
import { useState, useTransition } from 'react';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { giftCardBalance } from '../actions';

/** "Check a gift card": type the code, see the balance and the date (rate-limited on the server). */
export function GiftCardCheck({ t, locale }: { t: Dictionary['account']['rewards']; locale: string }) {
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await giftCardBalance(null, { code });
          if (r.ok) {
            const date = r.data.expiresAt
              ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(
                  new Date(r.data.expiresAt),
                )
              : '—';
            setAnswer({
              ok: true,
              text: interpolate(t.cardBalance, { balance: formatMoney(r.data.balanceCents, locale), date }),
            });
          } else {
            const why =
              r.error === 'RATE_LIMITED'
                ? t.tooMany
                : r.message === 'cardExpired'
                  ? t.cardExpired
                  : r.message === 'cardVoid'
                    ? t.cardVoid
                    : t.cardUnknown;
            setAnswer({ ok: false, text: why });
          }
        });
      }}
    >
      <div className="flex items-end gap-4">
        <label className="min-w-0 flex-1">
          <span className="eyebrow text-ink/60 mb-2 block">{t.cardTitle}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            className="border-border placeholder:text-ink/30 focus:border-gold-deep h-11 w-full border-b bg-transparent tracking-wider uppercase outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending || code.trim().length < 4}
          className="eyebrow border-ink text-ink hover:bg-ink hover:text-bone h-11 shrink-0 rounded-full border px-5 transition disabled:opacity-40"
        >
          {t.check}
        </button>
      </div>
      <p className="text-ink/55 text-xs">{t.cardText}</p>
      {answer && (
        <p role="status" className={`flex items-center gap-2 text-sm ${answer.ok ? 'text-gold-deep' : 'text-red-800'}`}>
          <Gift className="h-4 w-4" /> {answer.text}
        </p>
      )}
    </form>
  );
}
