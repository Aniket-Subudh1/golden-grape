import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Blocks } from '@/components/site/blocks';
import { alternates, isLocale, type Locale } from '@/lib/i18n';
import { getPage } from '@/modules/cms/service';

const SLUG = 'maison';

export async function generateMetadata({ params }: PageProps<'/[locale]/maison'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPage(SLUG, locale);
  return {
    title: page?.seo?.title || page?.title,
    description: page?.seo?.description,
    alternates: alternates(`/${SLUG}`, locale),
  };
}

async function Content({ locale }: { locale: Locale }) {
  const page = await getPage(SLUG, locale);
  if (!page) notFound();
  return <Blocks blocks={page.layout} locale={locale} />;
}

export default async function MaisonPage({ params }: PageProps<'/[locale]/maison'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Content locale={locale} />
    </Suspense>
  );
}
