import type { Metadata } from 'next';
import { CalendarDays, Clock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Markdown } from '@/components/site/blocks';
import { Container } from '@/components/site/container';
import { Poster } from '@/components/site/media-card';
import { PageHero } from '@/components/site/page-hero';
import { alternates, getDictionary, interpolate, isLocale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { stripMarkdown } from '@/lib/rich-text';
import { eventDate } from '@/lib/time';
import { mediaOf } from '@/modules/cms/service';
import { ReserveDialog } from '@/modules/events/components/reserve-dialog';
import { getEvent, seatsLeft } from '@/modules/events/service';

type Props = PageProps<'/[locale]/events/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const event = await getEvent(slug, locale);
  return {
    title: event?.seo?.title || event?.title,
    // The words of the description, without Markdown marks, at Google's length (GG-14).
    description: event?.seo?.description || (event?.description ? stripMarkdown(event.description).replace(/\s+/g, ' ').slice(0, 160) : undefined),
    alternates: alternates(`/events/${slug}`, locale),
  };
}

async function EventDetail({ params }: Pick<Props, 'params'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [event, dict] = await Promise.all([getEvent(slug, locale), getDictionary(locale)]);
  if (!event) notFound();
  const t = dict.eventsPage;
  const left = (await seatsLeft([event.id]))[event.id] ?? null;
  const { date, time } = eventDate(event.startsAt, event.endsAt, locale);
  const image = mediaOf(event.image);
  const description = event.description?.trim() ?? '';
  // Compact and structured (QA 12 Nov, GG-15): date, time, price and the booking button first, then the poster whole,
  // beside the text on large screens (both staying in view while it is read); on phones box, poster, then text.
  return (
    <>
      <PageHero compact eyebrow={`${date} · ${time}`} title={[event.title]} />
      <section className="pb-20">
        <Container className="grid gap-8 px-6 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-6 self-start lg:sticky lg:top-28 lg:col-span-5">
            <div className="space-y-3 border border-border/70 bg-champagne/30 p-5">
              <p className="flex items-center gap-3 text-sm">
                <CalendarDays className="h-4 w-4 text-gold-deep" /> {date}
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-gold-deep" /> {time}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <p className="font-serif text-3xl">{event.priceCents ? formatMoney(event.priceCents, locale, { compact: true }) : t.free}</p>
                <ReserveDialog
                  event={{ id: event.id, title: event.title, when: `${date} · ${time}`, priceCents: event.priceCents }}
                  left={left}
                  locale={locale}
                  t={t}
                  form={dict.form}
                  check={{ missing: dict.checkout.missing, check: dict.checkout.check }}
                  labels={{ minus: dict.cart.minus, plus: dict.cart.plus }}
                />
              </div>
              {left !== null && left <= 10 && (
                <p className="text-[11px] tracking-[0.18em] text-gold-deep uppercase">
                  {left === 0 ? t.dialog.soldOut : interpolate(left === 1 ? t.dialog.seatsLeft_one : t.dialog.seatsLeft_other, { count: left })}
                </p>
              )}
            </div>
            {image && (
              <div className="relative aspect-[4/5] max-h-[50vh] w-full overflow-hidden bg-ink">
                <Poster src={image.src} alt={image.alt || event.title} sizes="(min-width: 1024px) 40vw, 100vw" priority />
              </div>
            )}
          </div>
          <div className={image ? 'lg:col-span-7' : 'max-w-3xl lg:col-span-7'}>
            {/* Headings, bold and lists typed in the description render as such (GG-14). */}
            {description && <Markdown text={description} className="space-y-4 text-base md:text-[17px] [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-xl" />}
            <Link href={localePath(locale, '/events')} className="eyebrow mt-10 inline-block text-ink/60 transition hover:text-gold-deep">
              ← {t.back}
            </Link>
          </div>
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
