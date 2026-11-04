'use client';

import { Button } from '@/components/ui/button';
import { useCart } from '@/modules/webshop/cart';

/** The counter's three CTAs: open the cart directly in pick-up, delivery or table mode (prototype snack.tsx). */
export function CounterCtas({ t }: { t: { pickup: string; delivery: string; table: string } }) {
  const { openAs } = useCart();
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      <Button onClick={() => openAs('pickup')}>{t.pickup}</Button>
      <Button variant="outline" onClick={() => openAs('delivery')}>
        {t.delivery}
      </Button>
      <Button variant="gold" onClick={() => openAs('table')}>
        {t.table}
      </Button>
    </div>
  );
}
