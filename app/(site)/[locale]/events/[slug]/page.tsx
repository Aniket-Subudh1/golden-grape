import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { PageHero } from '@/components/site/page-hero';
import { Button } from '@/components/ui/button';
import { alternates, getDictionary, isLocale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { eventDate } from '@/lib/time';
import { mediaOf } from '@/modules/cms/service';
import { getEvent } from '@/modules/events/service';

type Props = PageProps<'/[locale]/events/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const event = await getEvent(slug, locale);
  return {
    title: event?.seo?.title || event?.title,
    description: event?.seo?.description || event?.description,
    alternates: alternates(`/events/${slug}`, locale),
  };
}

async function EventDetail({ params }: Pick<Props, 'params'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [event, { eventsPage: t }] = await Promise.all([getEvent(slug, locale), getDictionary(locale)]);
  if (!event) notFound();
  const { date, time } = eventDate(event.startsAt, event.endsAt, locale);
  const image = mediaOf(event.image);
  return (
    <>
      <PageHero eyebrow={`${date} · ${time}`} title={[event.title]} subtitle={event.description}>
        <div className="mt-8 flex flex-wrap items-center gap-8">
          <p className="font-serif text-3xl">{event.priceCents ? formatMoney(event.priceCents, locale, { compact: true }) : t.free}</p>
          <Button asChild>
            <Link href={localePath(locale, '/contact')}>{t.reserve}</Link>
          </Button>
        </div>
      </PageHero>
      <section className="pb-32">
        <Container className="px-6">
          {image && (
            <div className="relative aspect-[21/9] overflow-hidden bg-ink">
              <Image src={image.src} alt={image.alt || event.title} fill sizes="100vw" className="object-cover" />
            </div>
          )}
          <Link href={localePath(locale, '/events')} className="eyebrow mt-12 inline-block text-ink/60 transition hover:text-gold-deep">
            ← {t.back}
          </Link>
        </Container>
      </section>
    </>
  );
}

// `slug` is only known at request time, so the whole event streams behind Suspense.
export default function EventPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <EventDetail params={params} />
    </Suspense>
  );
}
