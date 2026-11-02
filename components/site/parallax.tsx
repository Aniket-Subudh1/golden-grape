'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { gsap, MOTION_OK } from '@/lib/gsap';

/** Slowly drifts its content while the parent scrolls through the view. The parent must clip (overflow-hidden). */
export function Parallax({ children, amount = 8, className }: { children: ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        el,
        { yPercent: -amount },
        { yPercent: amount, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
    return () => mm.revert();
  }, [amount]);
  return (
    <div ref={ref} className={cn('absolute inset-x-0 -inset-y-[12%] will-change-transform', className)}>
      {children}
    </div>
  );
}
