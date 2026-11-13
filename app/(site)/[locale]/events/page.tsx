import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { MediaCard } from '@/components/site/media-card';
import { MediaGrid } from '@/components/site/media-grid';
import { PageHero } from '@/components/site/page-hero';
import { alternates, type Dictionary, getDictionary, interpolate, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { stripMarkdown } from '@/lib/rich-text';
import { eventDate } from '@/lib/time';
import { mediaOf } from '@/modules/cms/service';
import { ReserveDialog } from '@/modules/events/components/reserve-dialog';
import { seatsLeft, upcomingEvents } from '@/modules/events/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/events'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.events, alternates: alternates('/events', locale) };
}

async function EventList({ locale, t, dict }: { locale: Locale; t: Dictionary['eventsPage']; dict: Dictionary }) {
  const events = await upcomingEvents(locale);
  if (events.length === 0) return <p className="max-w-xl text-lg font-light text-ink/60">{t.empty}</p>;
  const left = await seatsLeft(events.map((e) => e.id));
  // The grid follows how many events there are (APPLUX audit 10 Nov, §5): one or two get wide cards, never a narrow
  // column with a tall block of text beside an empty page.
  const cols = events.length >= 4 ? 4 : events.length === 3 ? 3 : 2;
  return (
    <MediaGrid cols={cols} hairline className={events.length === 1 ? 'sm:grid-cols-1 max-w-2xl' : undefined}>
      {events.map((e) => {
        const { date, time } = eventDate(e.startsAt, e.endsAt, locale);
        const seats = left[e.id];
        return (
          // The whole card opens the event (QA 12 Nov, GG-13); the poster is shown whole, shorter (GG-12).
          <MediaCard
            key={e.id}
            image={mediaOf(e.image)?.src}
            alt={e.title}
            ratio={cols === 2 ? '16/9' : '4/3'}
            fit="contain"
            href={localePath(locale, `/events/${e.slug}`)}
            sizes={events.length === 1 ? '(min-width: 640px) 672px, 100vw' : cols === 2 ? '(min-width: 640px) 50vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
          >
            <div className="flex flex-1 flex-col p-6">
              <p className="eyebrow text-gold-deep">
                {date} · {time}
              </p>
              <h3 className="mt-2 font-serif text-2xl font-light transition-colors group-hover:text-gold-deep">{e.title}</h3>
              {seats != null && seats <= 10 && (
                <p className="mt-2 self-start rounded-full bg-gold/90 px-3 py-1 text-[10px] tracking-[0.18em] text-ink uppercase">
                  {seats === 0 ? t.dialog.soldOut : interpolate(seats === 1 ? t.dialog.seatsLeft_one : t.dialog.seatsLeft_other, { count: seats })}
                </p>
              )}
              {/* A short preview in plain words (no Markdown marks, GG-14); the whole text is on the event's page. */}
              {e.description && <p className="mt-3 line-clamp-3 text-sm font-light text-ink/60">{stripMarkdown(e.description).replace(/\s+/g, ' ')}</p>}
              <span aria-hidden className="mt-3 mb-auto self-start text-[11px] tracking-[0.22em] text-gold-deep uppercase transition-colors group-hover:text-ink">
                {t.more} →
              </span>
              <div className="relative z-10 mt-5 flex items-center justify-between">
                <span className="font-serif text-xl">{e.priceCents ? formatMoney(e.priceCents, locale, { compact: true }) : t.free}</span>
                <ReserveDialog
                  event={{ id: e.id, title: e.title, when: `${date} · ${time}`, priceCents: e.priceCents }}
                  left={seats ?? null}
                  locale={locale}
                  t={t}
                  form={dict.form}
                  check={{ missing: dict.checkout.missing, check: dict.checkout.check }}
                  labels={{ minus: dict.cart.minus, plus: dict.cart.plus }}
                  className="h-10 text-[10px]"
                />
              </div>
            </div>
          </MediaCard>
        );
      })}
    </MediaGrid>
  );
}

export default async function EventsPage({ params }: PageProps<'/[locale]/events'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const t = dict.eventsPage;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={[t.titleA, t.titleB]} subtitle={t.subtitle} />
      <section className="pb-32">
        <Container className="px-6">
          <Suspense fallback={null}>
            <EventList locale={locale} t={t} dict={dict} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
