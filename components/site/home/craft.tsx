import Image from 'next/image';
import { Container } from '@/components/site/container';
import { Reveal } from '@/components/site/reveal';
import type { Dictionary } from '@/lib/i18n';

const CRAFTS = ['port', 'cheese', 'pastel'] as const;

/** Three craft cards; photos from Home page settings. */
export function Craft({
  t,
  images = {},
}: {
  t: Dictionary['craft'];
  images?: Partial<Record<(typeof CRAFTS)[number], string | null>>;
}) {
  return (
    <section className="bg-bone py-24 md:py-36">
      <Container>
        <Reveal>
          <div className="mb-16 max-w-2xl md:mb-24">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="text-ink mt-6 font-serif text-4xl leading-[1.05] font-light md:text-6xl">
              {t.titleA}
              <br />
              <span className="text-gold-deep italic">{t.titleB}</span>
            </h2>
            <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed font-light">{t.body}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
          {CRAFTS.map((key, i) => (
            <Reveal key={key} delay={i * 120}>
              <figure className="group">
                <div className="bg-ink relative aspect-[4/5] overflow-hidden">
                  {images[key] && (
                    <Image
                      src={images[key]}
                      alt={t[key].title}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                    />
                  )}
                  <div className="from-ink/40 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
                </div>
                <figcaption className="border-border mt-6 flex items-baseline justify-between border-b pb-4">
                  <div>
                    <span className="eyebrow">{t[key].label}</span>
                    <h3 className="text-ink mt-2 font-serif text-2xl font-light">{t[key].title}</h3>
                  </div>
                  <span className="text-gold-deep font-serif text-sm italic">0{i + 1}</span>
                </figcaption>
                <p className="text-muted-foreground mt-4 text-sm font-light">{t[key].desc}</p>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
