import Image from 'next/image';
import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { heroWine } from '@/lib/brand';
import type { Dictionary } from '@/lib/i18n';

export function Hero({ t }: { t: Dictionary['hero'] }) {
  const ticker = [t.ticker.shop, t.ticker.snack, t.ticker.catering, t.ticker.events, t.ticker.boutique];
  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0">
        <Image src={heroWine} alt="" fill priority sizes="100vw" className="animate-slow-zoom object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-ink/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/50" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pt-28 pb-16 md:px-10 md:pt-36 md:pb-24">
        <div className="animate-fade-up max-w-2xl">
          <div className="mb-6 flex items-center gap-4">
            <span className="h-px w-10 bg-gold" />
            <span className="eyebrow text-gold">{t.eyebrow}</span>
          </div>
          <h1 className="font-serif text-[clamp(2.25rem,6vw,5.5rem)] leading-[0.98] font-light">
            {t.titleA}
            <br />
            <em className="text-gold-gradient font-normal not-italic">{t.titleB}</em>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed font-light text-bone/75 md:text-lg">{t.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Button asChild variant="goldGlass" size="lg">
              <a href="#universes">
                {t.cta}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
            </Button>
            <a
              href="#happy-hour"
              className="border-b border-transparent pb-1 text-[11px] tracking-[0.3em] text-bone/80 uppercase transition-colors hover:border-gold hover:text-gold"
            >
              {t.secondaryCta} →
            </a>
          </div>

          <div className="mt-10 hidden items-center gap-6 text-[10px] tracking-[0.35em] text-bone/50 uppercase md:flex">
            {ticker.map((word, i) => (
              <Fragment key={word}>
                {i > 0 && <span className="text-gold">·</span>}
                <span>{word}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 text-bone/60">
        <span className="text-[10px] tracking-[0.4em] uppercase">{t.scroll}</span>
        <span className="h-10 w-px bg-gradient-to-b from-gold to-transparent" />
      </div>
    </section>
  );
}
