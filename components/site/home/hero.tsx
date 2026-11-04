import Image from 'next/image';
import { Fragment } from 'react';
import { Parallax } from '@/components/site/parallax';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';

type Content = { eyebrow?: string | null; titleA?: string | null; titleB?: string | null; subtitle?: string | null };

/** The home hero. Title texts come from the Home page settings, each falling back to the dictionary when empty. */
export function Hero({ t: dict, content = {}, image }: { t: Dictionary['hero']; content?: Content; image?: string | null }) {
  const t = { ...dict, eyebrow: content.eyebrow || dict.eyebrow, titleA: content.titleA || dict.titleA, titleB: content.titleB || dict.titleB, subtitle: content.subtitle || dict.subtitle };
  const ticker = [t.ticker.shop, t.ticker.snack, t.ticker.catering, t.ticker.events, t.ticker.boutique];
  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0">
        <Parallax>
          {image && <Image src={image} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="animate-slow-zoom object-cover" />}
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/65 to-ink/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-ink/40" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pt-28 pb-16 md:px-10 md:pt-36 md:pb-24">
        <div className="animate-fade-up max-w-2xl">
          <div className="mb-6 flex items-center gap-4">
            <span className="h-px w-10 bg-gold" />
            <span className="eyebrow text-gold">{t.eyebrow}</span>
          </div>
          <h1 className="font-serif text-[clamp(2.25rem,6vw,5.5rem)] leading-[0.98] font-light">
            <span className="block overflow-hidden pb-[0.1em]">
              <span className="animate-rise block">{t.titleA}</span>
            </span>
            <span className="-mt-[0.1em] block overflow-hidden pb-[0.14em]">
              <em className="animate-rise text-gold-gradient block font-normal not-italic [animation-delay:140ms]">{t.titleB}</em>
            </span>
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

          <div className="mt-10 hidden w-max items-center gap-5 text-[10px] tracking-[0.3em] whitespace-nowrap text-bone/60 uppercase lg:flex">
            {ticker.map((word, i) => (
              <Fragment key={word}>
                {i > 0 && <span className="text-gold">·</span>}
                <span>{word}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-10 bottom-10 z-10 hidden flex-col items-center gap-3 text-bone/60 lg:flex">
        <span className="text-[10px] tracking-[0.4em] uppercase [writing-mode:vertical-rl]">{t.scroll}</span>
        <span className="h-10 w-px bg-gradient-to-b from-gold to-transparent" />
      </div>
    </section>
  );
}
