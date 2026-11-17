'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { type CartMode, useCart } from '@/modules/webshop/cart';

// The counter's ways to order (GG-038): pick-up and table, each a photo card from the shop's own photos
// (public/brand/snack-menu) with what it means in one line. A click opens the cart in that mode, as before. The
// counter's dishes are not delivered (client request 17 Nov), so there is no delivery card.

type CounterMode = Exclude<CartMode, 'delivery'>;
const PHOTOS: Record<CounterMode, string> = {
  pickup: '/brand/snack-menu/Snack_5.jpg',
  table: '/brand/snack-menu/Snack_2.jpg',
};

type Props = { t: Record<CounterMode, string>; hints: Record<CounterMode, string> };

export function CounterCtas({ t, hints }: Props) {
  const { openAs } = useCart();
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2">
      {(['pickup', 'table'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => openAs(mode)}
          className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl bg-ink text-left text-bone sm:aspect-[16/10]"
        >
          <Image src={PHOTOS[mode]} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-90" />
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
