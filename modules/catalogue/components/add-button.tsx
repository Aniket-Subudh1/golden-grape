'use client';

import { Check, Plus } from 'lucide-react';
import { useCart } from '@/modules/webshop/cart';

/** The round "+" on a product card; a gold check once the product is in the cart (prototype ProductCard). */
export function AddButton({ variant, label }: { variant: string; label: string }) {
  const { qtyOf, add } = useCart();
  const inCart = qtyOf(variant) > 0;
  return (
    <button
      type="button"
      onClick={() => add({ variant })}
      aria-label={label}
      className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-bone text-ink shadow-lg transition hover:bg-ink hover:text-bone focus-visible:outline-2 focus-visible:outline-gold-deep"
    >
      {inCart ? <Check className="h-4 w-4 text-gold-deep" /> : <Plus className="h-4 w-4" />}
    </button>
  );
}
