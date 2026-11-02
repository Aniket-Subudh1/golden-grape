import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Prose } from '@/components/site/blocks';
import { Container } from '@/components/site/container';
import { PageHero } from '@/components/site/page-hero';
import { alternates, isLocale } from '@/lib/i18n';
import { getLegal } from '@/modules/cms/service';

type Props = PageProps<'/[locale]/legal/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const doc = await getLegal(slug, locale);
  return { title: doc?.title, alternates: alternates(`/legal/${slug}`, locale), robots: { index: true } };
}

async function LegalDoc({ params }: Pick<Props, 'params'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const doc = await getLegal(slug, locale);
  if (!doc) notFound();
  return (
    <>
      <PageHero title={[doc.title]} />
      <section className="pb-32">
        <Container size="md" className="max-w-3xl px-6">
          <Prose data={doc.body} />
        </Container>
      </section>
    </>
  );
}

// `slug` is only known at request time, so the whole document streams behind Suspense.
export default function LegalPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LegalDoc params={params} />
    </Suspense>
  );
}
