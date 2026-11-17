'use client';

import { Gift, Sparkles, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

export type SaleExtras = { code: string; useLoyalty: boolean; giftCards: string[] };
export const NO_SALE_EXTRAS: SaleExtras = { code: '', useLoyalty: false, giftCards: [] };

type Texts = Dictionary['cart']['extras'];
type Q = {
  code: string | null;
  codeRejected: string | null;
  discountCents: number;
  loyaltyPointsUsed: number;
  loyaltyCents: number;
  giftCards: { code: string; amountCents: number }[];
  giftCardsRejected: { code: string; reason: string }[];
  loyaltyAvailable?: { points: number; valueCents: number };
};

const input =
  'border-border focus:border-gold-deep h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm uppercase outline-none placeholder:normal-case placeholder:text-ink/35';
const apply =
  'border-border hover:border-ink h-10 shrink-0 rounded-lg border bg-white px-3 text-sm font-medium transition disabled:opacity-40';

/**
 * The phone sale's code, points and gift cards (M3.2): the customer's points appear once a customer with points is
 * chosen; a gift card's QR scanned in the item field lands here too (sale-screen). Refusals say why.
 */
export function SaleExtrasCard({
  quote,
  extras,
  setExtras,
  t,
  locale,
}: {
  quote: Q | null;
  extras: SaleExtras;
  setExtras: (u: (c: SaleExtras) => SaleExtras) => void;
  t: Texts;
  locale: string;
}) {
  const [code, setCode] = useState('');
  const [card, setCard] = useState('');
  const money = (c: number) => formatMoney(c, locale);
  const reason = (r: string | null | undefined) => (r ? ((t.reasons as Record<string, string>)[r] ?? r) : null);
  const points = quote?.loyaltyAvailable?.points ?? 0;
  return (
    <section className="gg-card space-y-3 p-4">
      {extras.code ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            quote?.codeRejected ? 'bg-red-50 text-red-800' : 'bg-champagne/60',
          )}
        >
          <Tag className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{interpolate(t.codeApplied, { code: extras.code.toUpperCase() })}</span>
            {quote?.codeRejected ? (
              <span className="text-xs">{reason(quote.codeRejected)}</span>
            ) : quote?.discountCents ? (
              <span className="text-xs tabular-nums">−{money(quote.discountCents)}</span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label={t.remove}
            onClick={() => setExtras((c) => ({ ...c, code: '' }))}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) setExtras((c) => ({ ...c, code: code.trim() }));
            setCode('');
          }}
        >
          <label htmlFor="sale-code" className="sr-only">
            {t.code}
          </label>
          <input
            id="sale-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.code}
            className={input}
            autoComplete="off"
          />
          <button type="submit" className={apply} disabled={!code.trim()}>
            {t.apply}
          </button>
        </form>
      )}

      {points > 0 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#f3f5f9] px-3 py-2.5 text-sm">
          <Sparkles className="text-gold-deep h-4 w-4 shrink-0" />
          <span className="flex-1">
            {interpolate(t.points, { points, value: money(points * (quote?.loyaltyAvailable?.valueCents ?? 0)) })}
          </span>
          <input
            type="checkbox"
            checked={extras.useLoyalty}
            onChange={(e) => setExtras((c) => ({ ...c, useLoyalty: e.target.checked }))}
            className="h-5 w-5 accent-[var(--gold-deep)]"
          />
        </label>
      )}

      {extras.giftCards.map((c) => {
        const used = quote?.giftCards.find((g) => g.code === c);
        const refused = quote?.giftCardsRejected.find((g) => g.code === c);
        return (
          <div
            key={c}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              refused ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900',
            )}
          >
            <Gift className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{interpolate(t.card, { last: c.slice(-4) })}</span>
              {refused ? (
                <span className="text-xs">{reason(refused.reason)}</span>
              ) : used ? (
                <span className="text-xs tabular-nums">−{money(used.amountCents)}</span>
              ) : null}
            </span>
            <button
              type="button"
              aria-label={t.remove}
              onClick={() => setExtras((x) => ({ ...x, giftCards: x.giftCards.filter((g) => g !== c) }))}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {extras.giftCards.length < 5 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const normal = card.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (normal && !extras.giftCards.includes(normal))
              setExtras((c) => ({ ...c, giftCards: [...c.giftCards, normal] }));
            setCard('');
          }}
        >
          <label htmlFor="sale-card" className="sr-only">
            {t.giftCard}
          </label>
          <input
            id="sale-card"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            placeholder={t.giftCard}
            className={input}
            autoComplete="off"
          />
          <button type="submit" className={apply} disabled={!card.trim()}>
            {t.add}
          </button>
        </form>
      )}
    </section>
  );
}
