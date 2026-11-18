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
import { DiscountRows, PaymentRows, PriceExtras } from '@/modules/webshop/components/price-extras';
import { TABLE_BOOKING } from '@/modules/sales/order-states';
import { type CartMode, useCart } from '@/modules/webshop/cart';
import { QtyStepper } from './qty-stepper';

const MODES: { id: CartMode; icon: typeof ShoppingBag }[] = [
  { id: 'pickup', icon: ShoppingBag },
  { id: 'delivery', icon: Bike },
  { id: 'table', icon: UtensilsCrossed },
];

const percent = (bp: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);

/**
 * The side cart (prototype CartSheet): mode switch, lines with steppers, VAT-inclusive totals from the server quote.
 * Pickup and delivery are the basket's own mode (remembered). "Table" is only the view of this visit to the drawer:
 * it is forgotten on close, and the button carries it in the link (APPLUX audit 10 Nov, §1/§3).
 */
export function CartSheet({ locale, t }: { locale: Locale; t: Dictionary['cart'] }) {
  const { open, setOpen, mode, openMode, setMode, items, quote, pending, setQty, remove, extras, setExtras } =
    useCart();
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
  // Only shop goods are delivered (client request 17 Nov): said as soon as the basket holds something that is not, and
  // the way to checkout stays shut until those lines are removed or the mode changed (client request 18 Nov).
  const undeliverable = view === 'delivery' ? lines.filter((l) => !l.deliverable) : [];
  const undeliverableLines = undeliverable.length > 0;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} label={t.panier} closeLabel={t.close}>
      <header className="border-border/60 space-y-1 border-b px-6 pt-6 pb-4">
        <span className="eyebrow text-gold-deep">{view === 'table' ? t.reservationTitle : t.orderTitle}</span>
        <h2 className="font-serif text-3xl font-light">
          {t.panier} {count > 0 && <span className="text-ink/40 text-2xl">· {count}</span>}
        </h2>
      </header>

      <div className="px-6 pt-4">
        <div
          className="border-border/60 bg-champagne/60 grid grid-cols-3 gap-1 rounded-full border p-1"
          role="radiogroup"
          aria-label={t.modeLabel}
        >
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
        <p className="text-ink/50 mt-2 text-center text-[11px]">{t.hints[view]}</p>
        {shopLinesAtTable && (
          <p className="bg-champagne/70 text-ink/70 mt-2 rounded-lg px-3 py-2 text-center text-[11px]">
            {t.tableShopNote}
          </p>
        )}
        {undeliverableLines && (
          <div role="alert" className="bg-champagne/70 text-ink/70 mt-2 rounded-lg px-3 py-2.5 text-center text-[11px]">
            <p>{t.deliveryShopNote}</p>
            <button
              type="button"
              onClick={() => remove(undeliverable)}
              className="text-ink hover:text-gold-deep mt-1.5 inline-flex min-h-8 items-center gap-1 font-medium tracking-[0.18em] uppercase underline-offset-4 hover:underline"
            >
              <Trash2 className="h-3 w-3" /> {t.removeUndeliverable}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-ink/60 font-serif text-2xl italic">{t.empty.title}</p>
          <p className="text-ink/50 text-sm">{t.empty.subtitle}</p>
          {view === 'table' && (
            <Button asChild className="mt-4">
              <Link href={checkoutHref} onClick={close}>
                {t.bookTable}
              </Link>
            </Button>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href={localePath(locale, '/shop')}
              onClick={close}
              className="eyebrow border-gold-deep text-gold-deep border-b pb-1"
            >
              {t.toShop}
            </Link>
            <Link
              href={localePath(locale, '/snack')}
              onClick={close}
              className="eyebrow border-gold-deep text-gold-deep border-b pb-1"
            >
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
                <li
                  key={`${item.variant}:${item.unit ?? ''}`}
                  className="flex animate-pulse items-center gap-4"
                  aria-hidden
                >
                  <div className="bg-champagne/80 h-16 w-16 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-champagne/80 h-4 w-3/4 rounded" />
                    <div className="bg-champagne/60 h-3 w-1/3 rounded" />
                    <div className="bg-champagne/60 h-7 w-24 rounded-full" />
                  </div>
                </li>
              ))}
            {lines.map((line) => (
              <li key={`${line.variant}:${line.unit ?? ''}`} className="flex items-center gap-4">
                <div className="bg-champagne/60 relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                  {line.image && <Image src={line.image} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={localePath(locale, line.kind === 'snack' ? '/snack' : `/shop/${line.slug}`)}
                    onClick={close}
                    className="hover:text-gold-deep block truncate font-serif text-lg leading-tight"
                  >
                    {line.name}
                  </Link>
                  {view === 'delivery' && !line.deliverable && (
                    <span className="eyebrow bg-burgundy/10 text-burgundy mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px]">
                      {t.notDelivered}
                    </span>
                  )}
                  <p className="text-ink/50 text-xs">
                    {line.detail && <>{line.detail} · </>}
                    {formatMoney(line.unitPriceCents, locale)}
                  </p>
                  <div className="mt-2">
                    <QtyStepper
                      size="sm"
                      value={line.qty}
                      max={line.maxQty}
                      onChange={(qty) => setQty(line, qty)}
                      labels={steps}
                    />
                  </div>
                </div>
                <div className="text-right">
                  {line.promoCents > 0 && (
                    <p className="text-ink/40 text-xs tabular-nums line-through">
                      {formatMoney(line.unitPriceCents * line.qty, locale)}
                    </p>
                  )}
                  <p className={cn('text-sm font-medium tabular-nums', line.promoCents > 0 && 'text-gold-deep')}>
                    {formatMoney(line.totalCents, locale)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setQty(line, 0)}
                    className="text-ink/40 hover:text-gold-deep mt-1 inline-flex items-center gap-1 text-[10px] tracking-widest uppercase"
                  >
                    <Trash2 className="h-3 w-3" /> {t.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <footer className="border-border/60 bg-champagne/40 space-y-3 border-t px-6 py-5">
            {!quote && <div className="bg-champagne/70 h-[52px] animate-pulse rounded" aria-hidden />}
            <PriceExtras quote={quote} extras={extras} setExtras={setExtras} t={t.extras} locale={locale} />
            {quote && (
              <>
                <DiscountRows quote={quote} t={t.extras} locale={locale} />
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-ink/60">{t.total}</span>
                  <span className="font-serif text-2xl tabular-nums">{formatMoney(quote.totalCents, locale)}</span>
                </div>
                <dl className="text-ink/50 space-y-0.5 text-[11px]">
                  {quote.vatBreakdown.map((v) => (
                    <div key={v.rateBp} className="flex justify-between">
                      <dt>{interpolate(t.vatIncluded, { rate: percent(v.rateBp, locale) })}</dt>
                      <dd className="tabular-nums">{formatMoney(v.vatCents, locale)}</dd>
                    </div>
                  ))}
                </dl>
                <PaymentRows quote={quote} t={t.extras} locale={locale} />
              </>
            )}
            {undeliverableLines ? (
              <Button className="w-full" disabled>
                {t.checkout}
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href={checkoutHref} onClick={close}>
                  {view === 'table' ? t.bookTable : t.checkout}
                </Link>
              </Button>
            )}
          </footer>
        </>
      )}
    </Sheet>
  );
}
