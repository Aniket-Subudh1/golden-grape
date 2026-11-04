import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from '@/components/site/container';
import { Parallax } from '@/components/site/parallax';
import { Reveal } from '@/components/site/reveal';
import { cn } from '@/lib/cn';
import type { Dictionary } from '@/lib/i18n';

type Key = 'shop' | 'snack' | 'catering' | 'events';
const ORDER: Key[] = ['shop', 'snack', 'catering', 'events'];

/** `hrefs` holds only the universes whose page exists; the others render as unlinked cards. Photos from Home page settings. */
export function Universes({
  t,
  hrefs,
  images = {},
}: {
  t: Dictionary['universes'];
  hrefs: Partial<Record<Key, string>>;
  images?: Partial<Record<Key, string | null>>;
}) {
  return (
    <section id="universes" className="bg-bone relative py-24 md:py-40">
      <Container>
        <Reveal>
          <div className="mb-20 max-w-3xl md:mb-32">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="text-ink mt-6 font-serif text-4xl leading-[1.05] font-light md:text-6xl">
              {t.titleA}
              <br />
              <span className="text-gold-deep italic">{t.titleB}</span>
            </h2>
            <div className="hairline mt-10 w-24" style={{ background: 'var(--gold)' }} />
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {ORDER.map((key, i) => {
            const card = t[key];
            const href = hrefs[key];
            const className = 'group relative block aspect-[4/5] overflow-hidden bg-ink';
            const body: ReactNode = (
              <>
                <Parallax amount={6}>
                  {images[key] && (
                    <Image
                      src={images[key]}
                      alt={card.title}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover opacity-80 transition-all duration-[1400ms] ease-out group-hover:scale-105 group-hover:opacity-95"
                    />
                  )}
                </Parallax>
                <div className="from-ink via-ink/30 absolute inset-0 bg-gradient-to-t to-transparent" />
                <div className="ring-gold/0 group-hover:ring-gold/40 absolute inset-0 ring-1 transition-all duration-700 ring-inset" />
                <div className="text-bone absolute inset-0 flex flex-col justify-between p-8 md:p-12">
                  <div className="flex items-start justify-between">
                    <span className="text-gold font-serif text-sm tracking-widest">0{i + 1}</span>
                    <span className="eyebrow text-bone/60">{card.tagline}</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-5xl leading-none font-light md:text-7xl">{card.title}</h3>
                    <p className="text-bone/75 mt-5 max-w-md text-sm leading-relaxed font-light md:text-base">
                      {card.desc}
                    </p>
                    <div className="text-gold mt-8 inline-flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase">
                      {card.cta}
                      <span className="bg-gold h-px w-8 transition-all duration-500 group-hover:w-16" />
                    </div>
                  </div>
                </div>
              </>
            );
            return (
              <Reveal key={key} delay={i * 100} className={cn(i % 2 === 1 && 'md:mt-24')}>
                {href ? (
                  <Link href={href} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
