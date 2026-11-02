import Link from 'next/link';
import { Container } from '@/components/site/container';
import type { Dictionary } from '@/lib/i18n';

const KEYS = ['friday', 'golden', 'tasting'] as const;

// The per-event "Reserve" line is not rendered until event booking exists (M2.3).
export function Events({ t, calendarHref }: { t: Dictionary['eventsHome']; calendarHref: string }) {
  return (
    <section id="events" className="relative bg-champagne py-24 md:py-40">
      <Container>
        <div className="mb-16 flex flex-col gap-8 md:mb-24 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2 className="mt-6 font-serif text-4xl leading-[1.05] font-light text-ink md:text-6xl">
              {t.titleA}
              <br />
              <span className="text-gold-deep italic">{t.titleB}</span>
            </h2>
          </div>
          <Link
            href={calendarHref}
            className="inline-flex items-center gap-3 border-b border-gold pb-1 text-[11px] tracking-[0.3em] text-ink uppercase transition hover:text-gold-deep"
          >
            {t.fullCal} →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
          {KEYS.map((k) => (
            <article key={k} className="group bg-champagne p-8 transition-colors hover:bg-bone md:p-10">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-gold-deep">{t.items[k].date}</span>
                <span className="text-xs font-light text-muted-foreground">{t.items[k].time}</span>
              </div>
              <h3 className="mt-8 font-serif text-3xl font-light text-ink md:text-4xl">{t.items[k].title}</h3>
              <p className="mt-4 text-sm leading-relaxed font-light text-muted-foreground">{t.items[k].desc}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
