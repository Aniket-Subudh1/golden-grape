import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BannerPhoto, Banners } from '@/components/site/home/banners';
import { HomeContact } from '@/components/site/home/contact';
import { PhotoStrip, type StripPhoto } from '@/components/site/home/photo-strip';
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
    openGraph: {
      title: meta.home.ogTitle,
      description: meta.home.ogDescription,
      type: 'website',
      url: localePath(locale),
    },
    twitter: { card: 'summary_large_image', title: meta.home.ogTitle, description: meta.home.ogDescription },
  };
}

// The home page (client request 17 Nov): four banners (shop, table, catering, events), a band of the house's photos,
// then the contact details.
// The photos and the contact details are read at request time (behind Suspense); the words are static.

/** One banner's photo, read at request time; the banner's words are already on screen. */
async function BannerPhotoSection({
  locale,
  slot,
  eager,
}: {
  locale: Locale;
  slot: 'shop' | 'table' | 'catering' | 'events';
  eager?: 'high' | 'auto';
}) {
  const photo = mediaOf((await getHomePage(locale)).photos?.[slot]);
  return photo ? <BannerPhoto src={photo.src} eager={eager} /> : null;
}

async function GallerySection({ t, locale }: { t: Dictionary['home']['gallery']; locale: Locale }) {
  const [{ gallery }, settings] = await Promise.all([getHomePage(locale), getSettings()]);
  const photos: StripPhoto[] = (gallery ?? []).flatMap((m) =>
    // Each photo keeps its own shape, kept between upright and wide so no frame is a sliver or a banner.
    typeof m === 'object' && m.url
      ? [{ src: m.url, alt: m.alt ?? '', ratio: Math.min(1.5, Math.max(0.75, (m.width ?? 4) / (m.height ?? 5))) }]
      : [],
  );
  if (photos.length < 3) return null; // too few to drift
  return <PhotoStrip t={t} photos={photos} instagram={settings.business?.instagram} />;
}

async function ContactSection({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [settings, { photos }] = await Promise.all([getSettings(), getHomePage(locale)]);
  const { business: b, hours } = settings;
  if (!b?.street) return null; // BusinessSettings not filled in yet
  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings, localePath(locale))} />
      <HomeContact
        t={t.home.contact}
        labels={t.contactPage.info}
        photo={mediaOf(photos?.contact) ?? mediaOf(photos?.interior)}
        city={b.city}
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
    <>
      <h1 className="sr-only">{t.meta.home.title}</h1>
      {/* The banners' words are in the first paint; each photo streams in on its own (the home page settings). */}
      <Banners
        t={t.home}
        hrefs={hrefs}
        photos={Object.fromEntries(
          (['shop', 'table', 'catering', 'events'] as const).map((slot, i) => [
            slot,
            <Suspense key={slot} fallback={null}>
              <BannerPhotoSection locale={locale} slot={slot} eager={i === 0 ? 'high' : i === 1 ? 'auto' : undefined} />
            </Suspense>,
          ]),
        )}
      />
      <Suspense fallback={null}>
        <GallerySection t={t.home.gallery} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <ContactSection t={t} locale={locale} />
      </Suspense>
    </>
  );
}
