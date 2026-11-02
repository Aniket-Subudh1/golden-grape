'use client';

import { useEffect, useRef } from 'react';
import { gsap, MOTION_OK, ScrollTrigger } from '@/lib/gsap';
import type { Dictionary } from '@/lib/i18n';

const BASE_SECONDS = 70;

// Two identical halves slide by 50 %, so the loop is seamless. It follows the scroll: faster while scrolling,
// backwards when scrolling up, settling back to its slow drift; it nearly stops under the pointer.
export function Marquee({ t }: { t: Dictionary['marquee'] }) {
  const track = useRef<HTMLDivElement>(null);
  const half = [...t.words, ...t.words, ...t.words];

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const drift = gsap.to(el, { xPercent: -50, duration: BASE_SECONDS, ease: 'none', repeat: -1 });
      drift.totalTime(BASE_SECONDS * 100); // room to run backwards
      let direction = 1;
      const settle = (scale: number) => gsap.to(drift, { timeScale: scale, duration: 1.4, ease: 'power2.out', overwrite: true });
      const scroll = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate(self) {
          const velocity = self.getVelocity();
          if (velocity === 0) return;
          direction = velocity < 0 ? -1 : 1;
          gsap.set(drift, { timeScale: direction * (1 + Math.min(Math.abs(velocity) / 180, 8)) });
          settle(direction);
        },
      });
      const slow = () => settle(direction * 0.12);
      const resume = () => settle(direction);
      el.addEventListener('pointerenter', slow);
      el.addEventListener('pointerleave', resume);
      return () => {
        scroll.kill();
        el.removeEventListener('pointerenter', slow);
        el.removeEventListener('pointerleave', resume);
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="relative overflow-hidden border-y border-gold/15 bg-ink py-8 text-bone md:py-10">
      <div ref={track} className="flex w-max whitespace-nowrap will-change-transform">
        {[...half, ...half].map((word, i) => (
          <span key={i} className="flex items-center font-serif text-2xl font-light italic md:text-4xl" aria-hidden={i >= half.length}>
            <span className="px-8 opacity-85 transition-opacity hover:opacity-100 md:px-14">{word}</span>
            {/* The diamond between the rules of the logo's "Mäi Wäin" line. */}
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}
