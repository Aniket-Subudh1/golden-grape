import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Banners } from '@/components/site/home/banners';
import { HomeContact } from '@/components/site/home/contact';
import { JsonLd } from '@/components/site/json-ld';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { groupedHours } from '@/lib/time';
import { getHomePage, mediaOf } from '@/modules/cms/service';
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

// The home page (client request 17 Nov): four banners (shop, table, catering, events), then the contact details.
// The photos and the contact details are read at request time (behind Suspense); the rest is static.

async function BannersSection({ t, locale, hrefs }: { t: Dictionary['home']; locale: Locale; hrefs: Parameters<typeof Banners>[0]['hrefs'] }) {
  const { photos } = await getHomePage(locale);
  const photo = (key: 'shop' | 'table' | 'catering' | 'events') => mediaOf(photos?.[key])?.src ?? null;
  return <Banners t={t} hrefs={hrefs} images={{ shop: photo('shop'), table: photo('table'), catering: photo('catering'), events: photo('events') }} />;
}

async function ContactSection({ t, locale }: { t: Dictionary; locale: Locale }) {
  const settings = await getSettings();
  const { business: b, hours } = settings;
  if (!b?.street) return null; // BusinessSettings not filled in yet
  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings, localePath(locale))} />
      <HomeContact
        t={t.home.contact}
        labels={t.contactPage.info}
        address={[b.street, `L-${b.postalCode} ${b.city}${b.country ? `, ${b.country}` : ''}`]}
        phone={b.phone}
        email={b.email}
        hours={groupedHours(hours, locale)}
        directions={{ label: t.store.directions, href: directionsUrl(b) }}
        contactHref={localePath(locale, '/contact')}
      />
    </>
  );
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const hrefs = {
    shop: localePath(locale, '/shop'),
    table: localePath(locale, TABLE_BOOKING),
    takeaway: localePath(locale, '/snack'),
    catering: localePath(locale, '/catering'),
    events: localePath(locale, '/events'),
  };
  return (
    <div className="bg-ink">
      <h1 className="sr-only">{t.meta.home.title}</h1>
      {/* The fallback is the same banners without their photos, so nothing moves when they arrive. */}
      <Suspense fallback={<Banners t={t.home} hrefs={hrefs} />}>
        <BannersSection t={t.home} locale={locale} hrefs={hrefs} />
      </Suspense>
      <Suspense fallback={null}>
        <ContactSection t={t} locale={locale} />
      </Suspense>
    </div>
  );
}
