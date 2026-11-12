'use client';

import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { QtyStepper } from '@/components/site/qty-stepper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { useCart } from '@/modules/webshop/cart';
import type { BuyOption } from '@/modules/webshop/service';

type Text = { choose: string; perUnit: string; add: string; added: string; outOfStock: string; inStock: string; left: string; minus: string; plus: string };

/** The product page's purchase panel: bottle / box of 6 / box of 12 with their prices, quantity up to the stock, add to cart. */
export function BuyBox({ options, locale, t }: { options: BuyOption[]; locale: Locale; t: Text }) {
  const { qtyOf, add, setOpen } = useCart();
  const [key, setKey] = useState(() => (options.find((o) => o.maxQty === null || o.maxQty > 0) ?? options[0])?.key);
  const [qty, setQty] = useState(1);
  const option = options.find((o) => o.key === key);
  if (!option) return null;
  const room = option.maxQty === null ? null : Math.max(0, option.maxQty - qtyOf(option.variant, option.unit));
  const soldOut = room === 0;

  return (
    <div className="space-y-6">
      {options.length > 1 && (
        <fieldset>
          <legend className="eyebrow mb-3 text-ink/60">{t.choose}</legend>
          <div className="grid gap-2">
            {options.map((o) => {
              const out = o.maxQty === 0;
              return (
                <label
                  key={o.key}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-4 border px-4 py-3 transition',
                    o.key === key ? 'border-ink bg-champagne/40' : 'border-border hover:border-ink/40',
                    out && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="option"
                      value={o.key}
                      checked={o.key === key}
                      disabled={out}
                      onChange={() => {
                        setKey(o.key);
                        setQty(1);
                      }}
                      className="accent-gold-deep"
                    />
                    <span>
                      <span className="block text-sm">{o.label}</span>
                      {o.factor > 1 && <span className="block text-[11px] text-ink/50">{interpolate(t.perUnit, { price: formatMoney(Math.round(o.priceCents / o.factor), locale) })}</span>}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-serif text-lg tabular-nums">{formatMoney(o.priceCents, locale)}</span>
                    {out && <span className="eyebrow text-[9px] text-ink/50">{t.outOfStock}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {options.length === 1 && <p className="font-serif text-3xl tabular-nums">{formatMoney(option.priceCents, locale)}</p>}

      {/* Availability, always said (APPLUX report 4, §1): in stock, the last ones, or sold out. */}
      <p className={cn('flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase', soldOut ? 'text-burgundy' : room !== null && room <= 6 ? 'text-gold-deep' : 'text-emerald-800')}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {soldOut ? t.outOfStock : room !== null && room <= 6 ? interpolate(t.left, { count: room }) : t.inStock}
      </p>

      {/* Sold out: nothing to add, so no stepper and no button. */}
      {!soldOut && (
        <div className="flex flex-wrap items-center gap-4">
          <QtyStepper value={Math.min(qty, room ?? qty)} min={1} max={room} onChange={setQty} labels={{ minus: t.minus, plus: t.plus }} />
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              add({ variant: option.variant, unit: option.unit }, Math.min(qty, room ?? qty));
              toast.success(t.added);
              setQty(1);
              setOpen(true);
            }}
          >
            <ShoppingBag className="h-4 w-4" /> {t.add}
          </Button>
        </div>
      )}
    </div>
  );
}
