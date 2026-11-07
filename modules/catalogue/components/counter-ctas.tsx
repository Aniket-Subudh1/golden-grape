'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { type CartMode, useCart } from '@/modules/webshop/cart';

// The counter's three ways to order (GG-038): pick-up, delivery, table, each a photo card from the shop's own photos
// (public/brand/snack-menu) with what it means in one line. A click opens the cart in that mode, as before.

const PHOTOS: Record<CartMode, string> = {
  pickup: '/brand/snack-menu/Snack_5.jpg',
  delivery: '/brand/snack-menu/Snack_7.jpg',
  table: '/brand/snack-menu/Snack_2.jpg',
};

type Props = { t: Record<CartMode, string>; hints: Record<CartMode, string> };

export function CounterCtas({ t, hints }: Props) {
  const { openAs } = useCart();
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-3">
      {(['pickup', 'delivery', 'table'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => openAs(mode)}
          className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl bg-ink text-left text-bone sm:aspect-[4/3]"
        >
          <Image src={PHOTOS[mode]} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-90" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
          <span className="relative block p-5">
            <span className="flex items-center gap-2 font-serif text-2xl">
              {t[mode]}
              <ArrowRight className="h-4 w-4 text-gold transition group-hover:translate-x-1" />
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-bone/75">{hints[mode]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
