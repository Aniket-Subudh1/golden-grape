import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Craft } from '@/components/site/home/craft';
import { Events } from '@/components/site/home/events';
import { HappyHour } from '@/components/site/home/happy-hour';
import { Hero } from '@/components/site/home/hero';
import { Hospitality } from '@/components/site/home/hospitality';
import { Marquee } from '@/components/site/home/marquee';
import { Store } from '@/components/site/home/store';
import { Story } from '@/components/site/home/story';
import { Universes } from '@/components/site/home/universes';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { eventDate, groupedHours } from '@/lib/time';
import { getHappyHour, mediaOf } from '@/modules/cms/service';
import { upcomingEvents } from '@/modules/events/service';
import { getSettings } from '@/modules/settings/service';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return {
    title: meta.home.title,
    description: meta.home.description,
    alternates: alternates('/', locale),
    openGraph: { title: meta.home.ogTitle, description: meta.home.ogDescription, type: 'website', url: localePath(locale) },
    twitter: { card: 'summary_large_image', title: meta.home.ogTitle, description: meta.home.ogDescription },
  };
}

// The regions below read the CMS at request time (behind Suspense); the rest of the page is static.

async function StoreSection({ t, locale }: { t: Dictionary['store']; locale: Locale }) {
  const { business: b, hours, closedDates } = await getSettings();
  if (!b?.street) return null; // BusinessSettings not filled in yet
  const address = [b.street, `L-${b.postalCode} ${b.city}${b.country ? `, ${b.country}` : ''}`];
  const directions = b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(', '))}`;
  return (
    <Store
      t={t}
      address={address}
      hours={groupedHours(hours, locale)}
      schedule={hours}
      closedDates={closedDates}
      directionsHref={directions}
      tastingHref={localePath(locale, '/events')}
    />
  );
}

async function HappyHourSection({ t, locale }: { t: Dictionary['happyHour']; locale: Locale }) {
  const hh = await getHappyHour(locale);
  // An unsaved global has no days/time yet, whatever the generated types say.
  if (!hh.active || !hh.days?.length || !hh.from || !hh.titleA) return null;
  const content = {
    titleA: hh.titleA,
    titleB: hh.titleB,
    text: hh.text,
    image: mediaOf(hh.image)?.src,
    days: hh.days.map(Number),
    from: hh.from,
  };
  return <HappyHour t={t} locale={locale} content={content} />;
}

async function EventsSection({ t, locale }: { t: Dictionary['eventsHome']; locale: Locale }) {
  const events = await upcomingEvents(locale, 3);
  if (events.length === 0) return null;
  const items = events.map((e) => ({ id: e.id, title: e.title, description: e.description, ...eventDate(e.startsAt, e.endsAt, locale) }));
  return <Events t={t} events={items} calendarHref={localePath(locale, '/events')} />;
}

// The social-proof section is not rendered: its reviews were hard-coded in the prototype.
// Real Google reviews arrive with M3.3.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  return (
    <>
      <Hero t={t.hero} />
      <Universes t={t.universes} hrefs={{ catering: localePath(locale, '/catering'), events: localePath(locale, '/events') }} />
      <Marquee t={t.marquee} />
      <Hospitality t={t.hospitality} />
      <Craft t={t.craft} />
      <Suspense fallback={null}>
        <StoreSection t={t.store} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <HappyHourSection t={t.happyHour} locale={locale} />
      </Suspense>
      <Story t={t.story} />
      <Suspense fallback={null}>
        <EventsSection t={t.eventsHome} locale={locale} />
      </Suspense>
    </>
  );
}
