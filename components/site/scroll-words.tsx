'use client';

import { useEffect, useRef } from 'react';
import { gsap, MOTION_OK } from '@/lib/gsap';

/** A sentence whose words light up as it scrolls through the view. `<gold>…</gold>` words get the gold gradient. */
export function ScrollWords({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        el.querySelectorAll('[data-word]'),
        { opacity: 0.16 },
        { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 50%', scrub: 0.6 } },
      );
    });
    return () => mm.revert();
  }, []);
  const chunks = text.split(/<gold>(.*?)<\/gold>/);
  return (
    <span ref={ref}>
      {chunks.map((chunk, i) =>
        // Whitespace is kept as written, so punctuation stays attached to the word before it.
        chunk.split(/(\s+)/).map((part, j) =>
          part.trim() ? (
            <span key={`${i}-${j}`} data-word className={i % 2 === 1 ? 'text-gold-gradient' : undefined}>
              {part}
            </span>
          ) : (
            part
          ),
        ),
      )}
    </span>
  );
}
