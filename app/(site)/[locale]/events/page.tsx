import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { MediaCard } from '@/components/site/media-card';
import { MediaGrid } from '@/components/site/media-grid';
import { PageHero } from '@/components/site/page-hero';
import { alternates, type Dictionary, getDictionary, interpolate, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
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
  return (
    <MediaGrid cols={4} hairline>
      {events.map((e) => {
        const { date, time } = eventDate(e.startsAt, e.endsAt, locale);
        return (
          <MediaCard
            key={e.id}
            image={mediaOf(e.image)?.src}
            alt={e.title}
            ratio="4/5"
            overlay={
              <>
                <p className="eyebrow text-gold">{date}</p>
                <h3 className="mt-2 font-serif text-3xl font-light">
                  {/* The link covers the whole card. */}
                  <Link href={localePath(locale, `/events/${e.slug}`)} className="after:absolute after:inset-0">
                    {e.title}
                  </Link>
                </h3>
                <p className="mt-1 text-xs opacity-80">{time}</p>
                {left[e.id] != null && left[e.id]! <= 10 && (
                  <p className="mt-3 inline-flex rounded-full bg-gold/90 px-3 py-1 text-[10px] tracking-[0.18em] text-ink uppercase">
                    {left[e.id] === 0 ? t.dialog.soldOut : interpolate(left[e.id] === 1 ? t.dialog.seatsLeft_one : t.dialog.seatsLeft_other, { count: left[e.id]! })}
                  </p>
                )}
              </>
            }
          >
            <div className="flex flex-1 flex-col p-6">
              <p className="flex-1 text-sm font-light text-ink/60">{e.description}</p>
              <div className="relative z-10 mt-5 flex items-center justify-between">
                <span className="font-serif text-xl">{e.priceCents ? formatMoney(e.priceCents, locale, { compact: true }) : t.free}</span>
                <ReserveDialog
                  event={{ id: e.id, title: e.title, when: `${date} · ${time}`, priceCents: e.priceCents }}
                  left={left[e.id] ?? null}
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
