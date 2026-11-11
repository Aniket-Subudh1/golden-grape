'use client';

import { Bike, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { type Dictionary, interpolate, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { TABLE_BOOKING } from '@/modules/sales/order-states';
import { type CartMode, useCart } from '@/modules/webshop/cart';
import { QtyStepper } from './qty-stepper';

const MODES: { id: CartMode; icon: typeof ShoppingBag }[] = [
  { id: 'pickup', icon: ShoppingBag },
  { id: 'delivery', icon: Bike },
  { id: 'table', icon: UtensilsCrossed },
];

const percent = (bp: number, locale: Locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);

/**
 * The side cart (prototype CartSheet): mode switch, lines with steppers, VAT-inclusive totals from the server quote.
 * Pickup and delivery are the basket's own mode (remembered). "Table" is only the view of this visit to the drawer:
 * it is forgotten on close, and the button carries it in the link (APPLUX audit 10 Nov, §1/§3).
 */
export function CartSheet({ locale, t }: { locale: Locale; t: Dictionary['cart'] }) {
  const { open, setOpen, mode, openMode, setMode, items, quote, pending, setQty } = useCart();
  const [picked, setPicked] = useState<CartMode | null>(null);
  const view = picked ?? openMode ?? mode;
  const lines = quote?.lines ?? [];
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const steps = { minus: t.minus, plus: t.plus };
  const close = () => {
    setPicked(null);
    setOpen(false);
  };
  const pick = (id: CartMode) => {
    setPicked(id);
    if (id !== 'table') setMode(id);
  };
  const checkoutHref = localePath(locale, view === 'table' ? TABLE_BOOKING : '/checkout');
  // At a table only the counter's dishes and drinks can be pre-ordered; shop items wait in the basket.
  const shopLinesAtTable = view === 'table' && lines.some((l) => l.kind !== 'snack');

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} label={t.panier} closeLabel={t.close}>
      <header className="space-y-1 border-b border-border/60 px-6 pt-6 pb-4">
        <span className="eyebrow text-gold-deep">{view === 'table' ? t.reservationTitle : t.orderTitle}</span>
        <h2 className="font-serif text-3xl font-light">
          {t.panier} {count > 0 && <span className="text-2xl text-ink/40">· {count}</span>}
        </h2>
      </header>

      <div className="px-6 pt-4">
        <div className="grid grid-cols-3 gap-1 rounded-full border border-border/60 bg-champagne/60 p-1" role="radiogroup" aria-label={t.modeLabel}>
          {MODES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              onClick={() => pick(id)}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[10px] tracking-[0.22em] uppercase transition',
                view === id ? 'bg-ink text-bone shadow-sm' : 'text-ink/60 hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.modes[id]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-ink/50">{t.hints[view]}</p>
        {shopLinesAtTable && <p className="mt-2 rounded-lg bg-champagne/70 px-3 py-2 text-center text-[11px] text-ink/70">{t.tableShopNote}</p>}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-serif text-2xl text-ink/60 italic">{t.empty.title}</p>
          <p className="text-sm text-ink/50">{t.empty.subtitle}</p>
          {view === 'table' && (
            <Button asChild className="mt-4">
              <Link href={checkoutHref} onClick={close}>
                {t.bookTable}
              </Link>
            </Button>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href={localePath(locale, '/shop')} onClick={close} className="eyebrow border-b border-gold-deep pb-1 text-gold-deep">
              {t.toShop}
            </Link>
            <Link href={localePath(locale, '/snack')} onClick={close} className="eyebrow border-b border-gold-deep pb-1 text-gold-deep">
              {t.toCounter}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5" aria-busy={pending}>
            {/* Until the first quote arrives, one placeholder per line of the same height: nothing jumps (§4). */}
            {!quote &&
              items.map((item) => (
                <li key={`${item.variant}:${item.unit ?? ''}`} className="flex animate-pulse items-center gap-4" aria-hidden>
                  <div className="h-16 w-16 shrink-0 rounded-md bg-champagne/80" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-champagne/80" />
                    <div className="h-3 w-1/3 rounded bg-champagne/60" />
                    <div className="h-7 w-24 rounded-full bg-champagne/60" />
                  </div>
                </li>
              ))}
            {lines.map((line) => (
              <li key={`${line.variant}:${line.unit ?? ''}`} className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-champagne/60">
                  {line.image && <Image src={line.image} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={localePath(locale, line.kind === 'snack' ? '/snack' : `/shop/${line.slug}`)}
                    onClick={close}
                    className="block truncate font-serif text-lg leading-tight hover:text-gold-deep"
                  >
                    {line.name}
                  </Link>
                  <p className="text-xs text-ink/50">
                    {line.detail && <>{line.detail} · </>}
                    {formatMoney(line.unitPriceCents, locale)}
                  </p>
                  <div className="mt-2">
                    <QtyStepper size="sm" value={line.qty} max={line.maxQty} onChange={(qty) => setQty(line, qty)} labels={steps} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{formatMoney(line.totalCents, locale)}</p>
                  <button
                    type="button"
                    onClick={() => setQty(line, 0)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] tracking-widest text-ink/40 uppercase hover:text-gold-deep"
                  >
                    <Trash2 className="h-3 w-3" /> {t.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <footer className="space-y-3 border-t border-border/60 bg-champagne/40 px-6 py-5">
            {!quote && <div className="h-[52px] animate-pulse rounded bg-champagne/70" aria-hidden />}
            {quote && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-ink/60">{t.total}</span>
                  <span className="font-serif text-2xl tabular-nums">{formatMoney(quote.totalCents, locale)}</span>
                </div>
                <dl className="space-y-0.5 text-[11px] text-ink/50">
                  {quote.vatBreakdown.map((v) => (
                    <div key={v.rateBp} className="flex justify-between">
                      <dt>{interpolate(t.vatIncluded, { rate: percent(v.rateBp, locale) })}</dt>
                      <dd className="tabular-nums">{formatMoney(v.vatCents, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <Button asChild className="w-full">
              <Link href={checkoutHref} onClick={close}>
                {view === 'table' ? t.bookTable : t.checkout}
              </Link>
            </Button>
          </footer>
        </>
      )}
    </Sheet>
  );
}
