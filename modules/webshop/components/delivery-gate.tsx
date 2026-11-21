'use client';

import { Bike } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { type Dictionary, interpolate, type Locale, localePath } from '@/lib/i18n';
import { TABLE_BOOKING } from '@/modules/sales/order-states';
import { useCart } from '@/modules/webshop/cart';

// Delivery shows only what is delivered (client request 18 Nov): in Delivery mode the counter's dishes and the shop's
// "pickup only" products are hidden; in Takeaway and Table they are there as usual. The rule itself is
// `isDeliverable` (modules/sales/zones.ts), which the server applies again when an order is placed.

/** True once the saved basket is read and it is in Delivery mode (before that, everything shows as the server drew it). */
export function useDeliveryMode() {
  const { ready, mode } = useCart();
  return ready && mode === 'delivery';
}

/** Its children, except in Delivery mode: then `fallback` (nothing by default). */
export function NotInDelivery({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useDeliveryMode() ? fallback : children;
}

/** The Counter page in Delivery mode: why there are no dishes, and the ways to have them. */
export function CounterDeliveryNote({ t, locale }: { t: Dictionary['snackPage']['delivery']; locale: Locale }) {
  const { setMode } = useCart();
  return (
    <div className="border-border bg-champagne/40 mx-auto max-w-2xl rounded-2xl border px-6 py-12 text-center md:px-12">
      <Bike className="text-gold-deep mx-auto h-6 w-6" />
      <h2 className="mt-4 font-serif text-3xl font-light">{t.title}</h2>
      <p className="text-ink/65 mx-auto mt-3 max-w-md text-sm leading-relaxed">{t.text}</p>
      {/* Wraps when the three do not fit in the box side by side (client report 22 Nov: they overlapped). */}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
        <Button onClick={() => setMode('pickup')}>{t.pickup}</Button>
        <Button asChild variant="outline">
          <Link href={localePath(locale, TABLE_BOOKING)}>{t.table}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={localePath(locale, '/shop')}>{t.shop}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Under the shop's product count in Delivery mode, when products of this page are hidden. */
export function HiddenInDelivery({ count, text }: { count: number; text: string }) {
  const delivery = useDeliveryMode();
  if (!delivery || count === 0) return null;
  return <p className="text-ink/50 mb-6 text-xs">{interpolate(text, { count })}</p>;
}
