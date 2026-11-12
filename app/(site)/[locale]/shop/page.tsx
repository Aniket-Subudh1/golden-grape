import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { PageHero } from '@/components/site/page-hero';
import { cn } from '@/lib/cn';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { Filters } from '@/modules/catalogue/components/filters';
import { ProductCard } from '@/modules/catalogue/components/product-card';
import { shopPage } from '@/modules/webshop/service';

type Props = PageProps<'/[locale]/shop'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  // Filtered views share the shop's canonical: one page in search results, not one per filter.
  return { ...meta.shop, alternates: alternates('/shop', locale), openGraph: { title: meta.shop.title, description: meta.shop.description, images: ['/brand/shop-wines-gourmet/Shop_14.jpg'] } };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
const cents = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) * 100 : undefined);

async function Results({ locale, t, searchParams }: { locale: Locale; t: Dictionary; searchParams: Props['searchParams'] }) {
  await connection();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const payload = await getPayloadClient();
  const data = await shopPage(payload, {
    locale,
    category: one(sp.category),
    q: one(sp.q),
    region: one(sp.region),
    colour: one(sp.colour),
    minCents: cents(one(sp.min)),
    maxCents: cents(one(sp.max)),
    page,
  });
  const pageHref = (n: number) => {
    const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v && k !== 'page' ? [[k, String(one(v))]] : [])));
    if (n > 1) next.set('page', String(n));
    const query = next.toString();
    return `${localePath(locale, '/shop')}${query ? `?${query}` : ''}`;
  };
  const s = t.shop;
  return (
    <>
      <Filters
        categories={data.categories.map((c) => ({ slug: c.slug, name: c.name }))}
        regions={data.facets.regions}
        colours={data.facets.colours}
        t={{ ...s.filters, all: s.categories.all, searchPh: s.searchPh, close: t.cart.close, colours: s.colours }}
      />
      <section className="pt-6 pb-16 md:pt-8">
        <Container>
          {data.products.length === 0 ? (
            <p className="py-24 text-center text-ink/50 italic">{s.empty}</p>
          ) : (
            <>
              <p className="eyebrow mb-4 text-ink/40">{s.count.replace('{{count}}', String(data.total))}</p>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:gap-8 lg:grid-cols-4">
                {data.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} locale={locale} t={s} priority={i < 4} />
                ))}
              </div>
            </>
          )}
          {data.totalPages > 1 && (
            <nav className="mt-16 flex items-center justify-center gap-2" aria-label={s.pages}>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === data.page ? 'page' : undefined}
                  className={cn('grid h-10 w-10 place-items-center rounded-full border text-sm tabular-nums transition', n === data.page ? 'border-ink bg-ink text-bone' : 'border-border hover:border-ink')}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </Container>
      </section>
    </>
  );
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  return (
    <>
      <PageHero eyebrow={t.shop.eyebrow} title={[t.shop.titleA, t.shop.titleB]} subtitle={t.shop.subtitle} compact />
      <Suspense fallback={<div className="min-h-[60vh] border-y border-border/60" />}>
        <Results locale={locale} t={t} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
