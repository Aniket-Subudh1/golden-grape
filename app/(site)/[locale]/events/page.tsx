import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { MediaCard } from '@/components/site/media-card';
import { MediaGrid } from '@/components/site/media-grid';
import { PageHero } from '@/components/site/page-hero';
import { Button } from '@/components/ui/button';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { mediaOf } from '@/modules/cms/service';
import { upcomingEvents } from '@/modules/events/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/events'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.events, alternates: alternates('/events', locale) };
}

async function EventList({ locale, t }: { locale: Locale; t: Dictionary['eventsPage'] }) {
  const events = await upcomingEvents(locale);
  if (events.length === 0) return <p className="max-w-xl text-lg font-light text-ink/60">{t.empty}</p>;
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
              </>
            }
          >
            <div className="flex flex-1 flex-col p-6">
              <p className="flex-1 text-sm font-light text-ink/60">{e.description}</p>
              <div className="relative z-10 mt-5 flex items-center justify-between">
                <span className="font-serif text-xl">{e.priceCents ? formatMoney(e.priceCents, locale, { compact: true }) : t.free}</span>
                {/* Online booking arrives in M2.3; until then a request goes through the contact form. */}
                <Button asChild className="h-10 text-[10px]">
                  <Link href={localePath(locale, '/contact')}>{t.reserve}</Link>
                </Button>
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
  const { eventsPage: t } = await getDictionary(locale);
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={[t.titleA, t.titleB]} subtitle={t.subtitle} />
      <section className="pb-32">
        <Container className="px-6">
          <Suspense fallback={null}>
            <EventList locale={locale} t={t} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
