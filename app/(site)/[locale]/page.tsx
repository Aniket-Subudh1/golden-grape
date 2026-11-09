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
import { SocialBand } from '@/components/site/home/social-band';
import { Story } from '@/components/site/home/story';
import { Universes } from '@/components/site/home/universes';
import { JsonLd } from '@/components/site/json-ld';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { groupedHours } from '@/lib/time';
import { getHappyHour, getHomePage, mediaOf } from '@/modules/cms/service';
import { TABLE_BOOKING } from '@/modules/sales/order-states';
import { localBusinessJsonLd } from '@/modules/settings/seo';
import { directionsUrl, getSettings } from '@/modules/settings/service';

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

/** The Home page settings' photos (and hero texts), as plain URLs. */
async function homeContent(locale: Locale) {
  const home = await getHomePage(locale);
  const photo = (key: keyof NonNullable<typeof home.photos>) => mediaOf(home.photos?.[key])?.src ?? null;
  return {
    hero: { eyebrow: home.hero?.eyebrow, titleA: home.hero?.titleA, titleB: home.hero?.titleB, subtitle: home.hero?.subtitle },
    heroImage: mediaOf(home.hero?.image)?.src ?? null,
    universes: { shop: photo('shop'), snack: photo('snack'), catering: photo('catering'), events: photo('events') },
    craft: { port: photo('port'), cheese: photo('cheese'), pastel: photo('pastel') },
    table: photo('table'),
    interior: photo('interior'),
  };
}

async function HeroSection({ t, locale }: { t: Dictionary['hero']; locale: Locale }) {
  const c = await homeContent(locale);
  return <Hero t={t} content={c.hero} image={c.heroImage} />;
}

async function UniversesSection({ t, locale, hrefs }: { t: Dictionary['universes']; locale: Locale; hrefs: Parameters<typeof Universes>[0]['hrefs'] }) {
  return <Universes t={t} hrefs={hrefs} images={(await homeContent(locale)).universes} />;
}

async function HospitalitySection({ t, locale }: { t: Dictionary['hospitality']; locale: Locale }) {
  return <Hospitality t={t} image={(await homeContent(locale)).table} />;
}

async function CraftSection({ t, locale }: { t: Dictionary['craft']; locale: Locale }) {
  return <Craft t={t} images={(await homeContent(locale)).craft} />;
}

async function StoreSection({ t, locale }: { t: Dictionary['store']; locale: Locale }) {
  const [{ business: b, hours, closedDates }, { interior }] = await Promise.all([getSettings(), homeContent(locale)]);
  if (!b?.street) return null; // BusinessSettings not filled in yet
  const address = [b.street, `L-${b.postalCode} ${b.city}${b.country ? `, ${b.country}` : ''}`];
  return (
    <Store
      t={t}
      address={address}
      hours={groupedHours(hours, locale)}
      schedule={hours}
      closedDates={closedDates}
      directionsHref={directionsUrl(b)}
      tastingHref={localePath(locale, '/events')}
      image={interior}
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
  return <HappyHour t={t} locale={locale} content={content} reserveHref={localePath(locale, TABLE_BOOKING)} />;
}

async function BusinessJsonLd({ locale }: { locale: Locale }) {
  const settings = await getSettings();
  return settings.business?.street ? <JsonLd data={localBusinessJsonLd(settings, localePath(locale))} /> : null;
}

async function SocialSection({ t }: { t: Dictionary['socialProof'] }) {
  const { business: b } = await getSettings();
  if (!b?.street) return null;
  return <SocialBand t={t} instagram={b.instagram} facebook={b.facebook} googleHref={directionsUrl(b)} />;
}

// The social-proof section's reviews are not rendered: its reviews were hard-coded in the prototype and could not be
// verified. Real Google reviews arrive with M3.3.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const hrefs = { shop: localePath(locale, '/shop'), snack: localePath(locale, '/snack'), catering: localePath(locale, '/catering'), events: localePath(locale, '/events') };
  return (
    <>
      {/* Each section streams its CMS photo; the fallback is the same section without it, so nothing moves. */}
      <Suspense fallback={<Hero t={t.hero} />}>
        <HeroSection t={t.hero} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <BusinessJsonLd locale={locale} />
      </Suspense>
      <Suspense fallback={<Universes t={t.universes} hrefs={hrefs} />}>
        <UniversesSection t={t.universes} locale={locale} hrefs={hrefs} />
      </Suspense>
      <Marquee t={t.marquee} />
      <Suspense fallback={<Hospitality t={t.hospitality} />}>
        <HospitalitySection t={t.hospitality} locale={locale} />
      </Suspense>
      <Suspense fallback={<Craft t={t.craft} />}>
        <CraftSection t={t.craft} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <StoreSection t={t.store} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <HappyHourSection t={t.happyHour} locale={locale} />
      </Suspense>
      <Story t={t.story} />
      <Events t={t.eventsHome} calendarHref={localePath(locale, '/events')} reserveHref={localePath(locale, '/events')} />
      <Suspense fallback={null}>
        <SocialSection t={t.socialProof} />
      </Suspense>
    </>
  );
}
