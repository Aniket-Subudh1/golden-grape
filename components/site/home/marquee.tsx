import type { Dictionary } from '@/lib/i18n';

// Two identical halves slide by 50 %, so the loop is seamless. Static under prefers-reduced-motion.
export function Marquee({ t }: { t: Dictionary['marquee'] }) {
  const half = [...t.words, ...t.words, ...t.words];
  const stream = [...half, ...half];
  return (
    <div className="relative overflow-hidden border-y border-bone/10 bg-ink py-8 text-bone">
      <div className="animate-marquee flex w-max whitespace-nowrap hover:[animation-play-state:paused]">
        {stream.map((word, i) => (
          <span key={i} className="mx-8 font-serif text-2xl font-light italic opacity-80 transition hover:opacity-100 md:mx-14 md:text-4xl">
            {word}
            <span className="ml-8 text-gold md:ml-14">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
