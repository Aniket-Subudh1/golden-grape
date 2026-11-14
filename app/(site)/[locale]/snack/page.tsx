import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { MediaGrid } from '@/components/site/media-grid';
import { PageHero } from '@/components/site/page-hero';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { MenuCard } from '@/modules/catalogue/components/menu-card';
import { CounterCtas } from '@/modules/catalogue/components/counter-ctas';
import { counterMenu } from '@/modules/webshop/service';

type Props = PageProps<'/[locale]/snack'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.snack, alternates: alternates('/snack', locale), openGraph: { title: meta.snack.title, description: meta.snack.description, images: ['/brand/snack-menu/Snack_3.jpg'] } };
}

async function Menu({ locale, t }: { locale: Locale; t: Dictionary }) {
  await connection();
  const items = await counterMenu(await getPayloadClient(), locale);
  if (items.length === 0) return <p className="py-24 text-center text-ink/50 italic">{t.snackPage.empty}</p>;
  return (
    <MediaGrid cols={3} hairline>
      {items.map((item) => (
        <MenuCard key={item.id} item={item} locale={locale} t={t.snackPage} steps={{ minus: t.cart.minus, plus: t.cart.plus }} />
      ))}
    </MediaGrid>
  );
}

export default async function SnackPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  return (
    <>
      <PageHero eyebrow={t.snackPage.eyebrow} title={[t.snackPage.titleA, t.snackPage.titleB]} subtitle={t.snackPage.subtitle}>
        <CounterCtas t={t.snackPage.ctas} hints={t.cart.hints} />
      </PageHero>
      <section className="pb-32">
        <Container>
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <Menu locale={locale} t={t} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
