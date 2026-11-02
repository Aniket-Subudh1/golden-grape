import Image from 'next/image';
import { Container } from '@/components/site/container';
import { Reveal } from '@/components/site/reveal';
import { gourmetTable } from '@/lib/brand';
import type { Dictionary } from '@/lib/i18n';

export function Hospitality({ t }: { t: Dictionary['hospitality'] }) {
  return (
    <section className="relative bg-bone">
      <Container className="py-24 md:py-36">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-12 lg:gap-20">
          <Reveal className="order-2 md:order-1 md:col-span-6">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="mt-6 font-serif text-4xl leading-[1.05] font-light text-ink md:text-5xl">
              {t.titleA}
              <br />
              <span className="text-gold-deep italic">{t.titleB}</span>
            </h2>
            <p className="mt-8 max-w-md text-base leading-relaxed font-light text-muted-foreground">{t.body}</p>
            <ul className="mt-10 space-y-4">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-center gap-4 text-sm font-light text-ink">
                  <span className="h-px w-8 bg-gold" />
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={150} className="order-1 md:order-2 md:col-span-6">
            <div className="relative aspect-[4/5] overflow-hidden bg-ink">
              <Image src={gourmetTable} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 ring-1 ring-gold/20 ring-inset" />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
