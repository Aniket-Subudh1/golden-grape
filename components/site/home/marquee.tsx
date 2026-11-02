import type { Dictionary } from '@/lib/i18n';

// Static: the prototype's `animate-marquee` class is defined nowhere, so it never moved.
export function Marquee({ t }: { t: Dictionary['marquee'] }) {
  const stream = [...t.words, ...t.words, ...t.words];
  return (
    <div className="relative overflow-hidden border-y border-bone/10 bg-ink py-8 text-bone">
      <div className="flex whitespace-nowrap">
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
