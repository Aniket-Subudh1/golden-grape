'use client';

import { ChevronDown, Gift, Tag, X } from 'lucide-react';
import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { CartQuote } from '@/modules/promotions/service';
import type { CartExtras } from '../cart';

type Texts = Dictionary['cart']['extras'];
type Q = Pick<
  CartQuote,
  | 'code'
  | 'codeRejected'
  | 'discountCents'
  | 'loyaltyPointsUsed'
  | 'loyaltyCents'
  | 'giftCards'
  | 'giftCardsRejected'
  | 'amountDueCents'
  | 'totalCents'
  | 'loyaltyAvailable'
>;

const field =
  'h-10 min-w-0 flex-1 border-b border-border bg-transparent text-sm uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink/35 focus:border-gold-deep';
const small = 'eyebrow shrink-0 text-gold-deep hover:text-ink disabled:opacity-40';

/**
 * A discount code, "use my points" and gift cards (M3.2), folded under one line until used: the cart and checkout
 * show the same. Everything is re-quoted on the server; a refused code or card says why, in the customer's language.
 */
export function PriceExtras({
  quote,
  extras,
  setExtras,
  t,
  locale,
}: {
  quote: Q | null;
  extras: CartExtras;
  setExtras: (u: (c: CartExtras) => CartExtras) => void;
  t: Texts;
  locale: string;
}) {
  const [open, setOpen] = useState(Boolean(extras.code || extras.useLoyalty || extras.giftCards.length));
  const [code, setCode] = useState('');
  const [card, setCard] = useState('');
  const money = (c: number) => formatMoney(c, locale);
  const reason = (r: string | null | undefined) => (r ? ((t.reasons as Record<string, string>)[r] ?? r) : null);
  const points = quote?.loyaltyAvailable?.points ?? 0;

  return (
    <div className="border-border/60 border-y py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-ink/70 hover:text-ink flex w-full items-center justify-between text-left text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <Tag className="text-gold-deep h-4 w-4" />
          {t.more}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {extras.code ? (
            <div className="space-y-1">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className={quote?.codeRejected ? 'text-red-800 line-through' : ''}>
                  {interpolate(t.codeApplied, { code: extras.code.toUpperCase() })}
                </span>
                <button type="button" className={small} onClick={() => setExtras((c) => ({ ...c, code: '' }))}>
                  {t.remove}
                </button>
              </p>
              {quote?.codeRejected && (
                <p className="text-xs text-red-800" role="alert">
                  {reason(quote.codeRejected)}
                </p>
              )}
            </div>
          ) : (
            <form
              className="flex items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) setExtras((c) => ({ ...c, code: code.trim() }));
                setCode('');
              }}
            >
              <label className="sr-only" htmlFor="extras-code">
                {t.code}
              </label>
              <input
                id="extras-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t.code}
                className={field}
                autoComplete="off"
              />
              <button type="submit" className={small} disabled={!code.trim()}>
                {t.apply}
              </button>
            </form>
          )}

          {points > 0 && (
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={extras.useLoyalty}
                onChange={(e) => setExtras((c) => ({ ...c, useLoyalty: e.target.checked }))}
                className="h-4 w-4 accent-[var(--gold-deep)]"
              />
              {interpolate(t.points, { points, value: money(points * (quote?.loyaltyAvailable?.valueCents ?? 0)) })}
            </label>
          )}

          <div className="space-y-2">
            {extras.giftCards.map((c) => {
              const used = quote?.giftCards.find((g) => g.code === c);
              const refused = quote?.giftCardsRejected.find((g) => g.code === c);
              return (
                <div key={c} className="space-y-0.5">
                  <p className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Gift className="text-gold-deep h-4 w-4" />
                      {interpolate(t.card, { last: c.slice(-4) })}
                      {used && <span className="text-ink/55 tabular-nums">−{money(used.amountCents)}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={t.remove}
                      className={small}
                      onClick={() => setExtras((x) => ({ ...x, giftCards: x.giftCards.filter((g) => g !== c) }))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </p>
                  {refused && (
                    <p className="text-xs text-red-800" role="alert">
                      {reason(refused.reason)}
                    </p>
                  )}
                </div>
              );
            })}
            {extras.giftCards.length < 5 && (
              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const normal = card.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (normal && !extras.giftCards.includes(normal))
                    setExtras((c) => ({ ...c, giftCards: [...c.giftCards, normal] }));
                  setCard('');
                }}
              >
                <label className="sr-only" htmlFor="extras-card">
                  {t.giftCard}
                </label>
                <input
                  id="extras-card"
                  value={card}
                  onChange={(e) => setCard(e.target.value)}
                  placeholder={`${t.giftCard} · ${t.giftCardPh}`}
                  className={field}
                  autoComplete="off"
                />
                <button type="submit" className={small} disabled={!card.trim()}>
                  {t.add}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The discount code's row above the total (promotions are already in each line's price, shown struck through). */
export function DiscountRows({
  quote,
  t,
  locale,
  className = '',
}: {
  quote: Q;
  t: Texts;
  locale: string;
  className?: string;
}) {
  if (!quote.discountCents || !quote.code) return null;
  return (
    <dl className={`text-sm ${className}`}>
      <div className="text-gold-deep flex justify-between">
        <dt>{interpolate(t.codeApplied, { code: quote.code })}</dt>
        <dd className="tabular-nums">−{formatMoney(quote.discountCents, locale)}</dd>
      </div>
    </dl>
  );
}

/** Below the total: points and gift cards used, and what is left to pay (shown only when they apply). */
export function PaymentRows({ quote, t, locale }: { quote: Q; t: Texts; locale: string }) {
  const money = (c: number) => formatMoney(c, locale);
  if (!quote.loyaltyCents && quote.giftCards.length === 0) return null;
  return (
    <dl className="border-border/60 space-y-1 border-t pt-2 text-sm">
      {quote.loyaltyCents > 0 && (
        <div className="text-ink/70 flex justify-between">
          <dt>{interpolate(t.pointsUsed, { points: quote.loyaltyPointsUsed })}</dt>
          <dd className="tabular-nums">−{money(quote.loyaltyCents)}</dd>
        </div>
      )}
      {quote.giftCards.map((g) => (
        <div key={g.code} className="text-ink/70 flex justify-between">
          <dt>{interpolate(t.card, { last: g.code.slice(-4) })}</dt>
          <dd className="tabular-nums">−{money(g.amountCents)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between pt-1">
        <dt className="eyebrow text-ink/70">{t.toPay}</dt>
        <dd className="font-serif text-2xl tabular-nums" data-testid="amount-due">
          {money(quote.amountDueCents)}
        </dd>
      </div>
    </dl>
  );
}
