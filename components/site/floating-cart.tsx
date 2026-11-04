'use client';

import { ShoppingBag } from 'lucide-react';
import type { Dictionary, Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { useCart } from '@/modules/webshop/cart';

/** The round cart button bottom-right (prototype FloatingCart), shown once something is in the cart. */
export function FloatingCart({ locale, t }: { locale: Locale; t: Dictionary['floatingCart'] }) {
  const { count, quote, setOpen, open } = useCart();
  if (count === 0 || open) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group animate-fade-in fixed right-5 bottom-5 z-40 flex items-center gap-3 rounded-full bg-ink py-3 pr-5 pl-4 text-bone shadow-2xl shadow-ink/30 transition-all hover:bg-gold-deep md:right-8 md:bottom-8"
      aria-label={t.openAria}
    >
      <span className="relative">
        <ShoppingBag className="h-5 w-5" />
        <span className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-medium text-ink">{count}</span>
      </span>
      <span className="hidden text-[11px] tracking-[0.28em] uppercase sm:inline">{t.label}</span>
      {quote && <span className="text-sm font-medium tabular-nums">{formatMoney(quote.totalCents, locale)}</span>}
    </button>
  );
}
