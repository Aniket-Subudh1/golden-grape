import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from '@/components/site/container';
import { Parallax } from '@/components/site/parallax';
import { Reveal } from '@/components/site/reveal';
import { universeCatering, universeEvents, universeShop, universeSnack } from '@/lib/brand';
import { cn } from '@/lib/cn';
import type { Dictionary } from '@/lib/i18n';

type Key = 'shop' | 'snack' | 'catering' | 'events';
const IMAGES: Record<Key, string> = { shop: universeShop, snack: universeSnack, catering: universeCatering, events: universeEvents };
const ORDER: Key[] = ['shop', 'snack', 'catering', 'events'];

/** `hrefs` holds only the universes whose page exists; the others render as unlinked cards. */
export function Universes({ t, hrefs }: { t: Dictionary['universes']; hrefs: Partial<Record<Key, string>> }) {
  return (
    <section id="universes" className="relative bg-bone py-24 md:py-40">
      <Container>
        <Reveal>
          <div className="mb-20 max-w-3xl md:mb-32">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="mt-6 font-serif text-4xl leading-[1.05] font-light text-ink md:text-6xl">
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
                  <Image
                    src={IMAGES[key]}
                    alt={card.title}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover opacity-80 transition-all duration-[1400ms] ease-out group-hover:scale-105 group-hover:opacity-95"
                  />
                </Parallax>
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                <div className="absolute inset-0 ring-1 ring-gold/0 transition-all duration-700 ring-inset group-hover:ring-gold/40" />
                <div className="absolute inset-0 flex flex-col justify-between p-8 text-bone md:p-12">
                  <div className="flex items-start justify-between">
                    <span className="font-serif text-sm tracking-widest text-gold">0{i + 1}</span>
                    <span className="eyebrow text-bone/60">{card.tagline}</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-5xl leading-none font-light md:text-7xl">{card.title}</h3>
                    <p className="mt-5 max-w-md text-sm leading-relaxed font-light text-bone/75 md:text-base">{card.desc}</p>
                    <div className="mt-8 inline-flex items-center gap-3 text-[11px] tracking-[0.3em] text-gold uppercase">
                      {card.cta}
                      <span className="h-px w-8 bg-gold transition-all duration-500 group-hover:w-16" />
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
