import Image from 'next/image';
import { Container } from '@/components/site/container';
import { Reveal } from '@/components/site/reveal';
import { craftCheese, craftPastel, craftPort } from '@/lib/brand';
import type { Dictionary } from '@/lib/i18n';

const CRAFTS = [
  { key: 'port', img: craftPort },
  { key: 'cheese', img: craftCheese },
  { key: 'pastel', img: craftPastel },
] as const;

export function Craft({ t }: { t: Dictionary['craft'] }) {
  return (
    <section className="bg-bone py-24 md:py-36">
      <Container>
        <Reveal>
          <div className="mb-16 max-w-2xl md:mb-24">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="mt-6 font-serif text-4xl leading-[1.05] font-light text-ink md:text-6xl">
              {t.titleA}
              <br />
              <span className="text-gold-deep italic">{t.titleB}</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed font-light text-muted-foreground">{t.body}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
          {CRAFTS.map(({ key, img }, i) => (
            <Reveal key={key} delay={i * 120}>
              <figure className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                  <Image
                    src={img}
                    alt={t[key].title}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />
                </div>
                <figcaption className="mt-6 flex items-baseline justify-between border-b border-border pb-4">
                  <div>
                    <span className="eyebrow">{t[key].label}</span>
                    <h3 className="mt-2 font-serif text-2xl font-light text-ink">{t[key].title}</h3>
                  </div>
                  <span className="font-serif text-sm text-gold-deep italic">0{i + 1}</span>
                </figcaption>
                <p className="mt-4 text-sm font-light text-muted-foreground">{t[key].desc}</p>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
