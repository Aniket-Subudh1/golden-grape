import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Craft } from '@/components/site/home/craft';
import { Events } from '@/components/site/home/events';
import { HappyHour } from '@/components/site/home/happy-hour';
import { Hero } from '@/components/site/home/hero';
import { Hospitality } from '@/components/site/home/hospitality';
import { Marquee } from '@/components/site/home/marquee';
import { Store } from '@/components/site/home/store';
import { Story } from '@/components/site/home/story';
import { Universes } from '@/components/site/home/universes';
import { alternates, getDictionary, isLocale, localePath } from '@/lib/i18n';

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

// The social-proof section is not rendered: its reviews were hard-coded in the prototype.
// Real Google reviews arrive with M3.3.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const events = localePath(locale, '/events');
  return (
    <>
      <Hero t={t.hero} />
      <Universes t={t.universes} hrefs={{ catering: localePath(locale, '/catering'), events }} />
      <Marquee t={t.marquee} />
      <Hospitality t={t.hospitality} />
      <Craft t={t.craft} />
      <Store t={t.store} tastingHref={events} />
      <HappyHour t={t.happyHour} locale={locale} />
      <Story t={t.story} />
      <Events t={t.eventsHome} calendarHref={events} />
    </>
  );
}
