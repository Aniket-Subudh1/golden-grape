import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHero } from '@/components/site/page-hero';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { CateringForm } from '@/modules/catering/components/catering-form';
import { earliestCateringDate, listPackages } from '@/modules/catering/service';
import { mediaOf } from '@/modules/cms/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/catering'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.catering, alternates: alternates('/catering', locale) };
}

async function Packages({ locale, t }: { locale: Locale; t: Dictionary }) {
  const packages = await listPackages(locale);
  const cards = packages.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    includes: (p.includes ?? []).map((i) => i.item),
    pricePerGuestCents: p.pricePerGuestCents,
    minGuests: p.minGuests,
    image: mediaOf(p.image)?.src,
  }));
  return <CateringForm t={t.cateringPage} form={t.form} locale={locale} packages={cards} minDate={earliestCateringDate()} />;
}

export default async function CateringPage({ params }: PageProps<'/[locale]/catering'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const p = t.cateringPage;
  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={[p.titleA, p.titleB]} subtitle={p.subtitle} className="pb-16" />
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Packages locale={locale} t={t} />
      </Suspense>
    </>
  );
}
