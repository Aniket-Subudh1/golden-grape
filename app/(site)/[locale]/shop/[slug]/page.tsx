import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Prose } from '@/components/site/blocks';
import { Container } from '@/components/site/container';
import { JsonLd } from '@/components/site/json-ld';
import { alternates, getDictionary, interpolate, isLocale, type Locale, localePath } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { plainText } from '@/lib/rich-text';
import { BuyBox } from '@/modules/catalogue/components/buy-box';
import { Gallery } from '@/modules/catalogue/components/gallery';
import { ProductCard } from '@/modules/catalogue/components/product-card';
import { breadcrumbJsonLd, productJsonLd } from '@/modules/catalogue/seo';
import { productPage } from '@/modules/webshop/service';

type Props = PageProps<'/[locale]/shop/[slug]'>;

async function load(locale: Locale, slug: string) {
  await connection();
  return productPage(await getPayloadClient(), slug, locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [data, { meta }] = await Promise.all([load(locale, slug), getDictionary(locale)]);
  if (!data) return { title: meta.shop.title };
  const { product, photos } = data;
  const title = product.seo?.title || interpolate(meta.product.title, { name: product.name });
  const description = product.seo?.description || plainText(product.description).replace(/\s+/g, ' ').slice(0, 160) || interpolate(meta.product.description, { name: product.name });
  return {
    title,
    description,
    alternates: alternates(`/shop/${slug}`, locale),
    openGraph: { type: 'website', title, description, images: photos[0] ? [{ url: photos[0].src, alt: photos[0].alt }] : undefined },
  };
}

const percent = (bp: number, locale: Locale) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bp / 100)} %`;

async function Product({ params }: Pick<Props, 'params'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [data, t] = await Promise.all([load(locale, slug), getDictionary(locale)]);
  if (!data) notFound();
  const { product, category, brand, photos, options, inStock, related } = data;
  const s = t.shop;
  const wine = product.kind === 'wine' ? product.wine : null;
  const facts: [string, string][] = [
    ...(brand ? [[s.facts.producer, brand.name] as [string, string]] : []),
    ...(wine?.region ? [[s.facts.region, wine.region] as [string, string]] : []),
    ...(wine?.grape ? [[s.facts.grape, wine.grape] as [string, string]] : []),
    ...(wine?.vintage ? [[s.facts.vintage, String(wine.vintage)] as [string, string]] : []),
    ...(wine?.colour ? [[s.facts.colour, (s.colours as Record<string, string>)[wine.colour] ?? wine.colour] as [string, string]] : []),
    ...(wine?.abv ? [[s.facts.abv, percent(wine.abv, locale)] as [string, string]] : []),
    ...(wine?.servingTemp ? [[s.facts.serve, wine.servingTemp] as [string, string]] : []),
  ];
  const path = `/shop/${product.slug}`;
  const cheapest = options.reduce<number | null>((min, o) => (min === null || o.priceCents < min ? o.priceCents : min), null);
  const tag = product.badges?.[0] ? (s.tags as Record<string, string>)[product.badges[0]] : null;

  return (
    <>
      {cheapest !== null && (
        <JsonLd
          data={[
            productJsonLd({
              name: product.name,
              description: product.seo?.description || plainText(product.description).replace(/\s+/g, ' ') || null,
              url: localePath(locale, path),
              images: photos.map((p) => p.src),
              brand: brand?.name,
              category: category?.name,
              priceCents: cheapest,
              inStock,
            }),
            breadcrumbJsonLd([
              { name: t.nav.shopLabel, path: localePath(locale, '/shop') },
              ...(category ? [{ name: category.name, path: `${localePath(locale, '/shop')}?category=${category.slug}` }] : []),
              { name: product.name, path: localePath(locale, path) },
            ]),
          ]}
        />
      )}
      <section className="pt-32 pb-20 md:pt-40">
        <Container>
          <nav aria-label={s.breadcrumb} className="eyebrow mb-10 flex flex-wrap items-center gap-2 text-ink/40">
            <Link href={localePath(locale, '/shop')} className="hover:text-gold-deep">
              {t.nav.shopLabel}
            </Link>
            {category && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={`${localePath(locale, '/shop')}?category=${category.slug}`} className="hover:text-gold-deep">
                  {category.name}
                </Link>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span className="text-ink/70" aria-current="page">
              {product.name}
            </span>
          </nav>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Gallery photos={photos} name={product.name} />
            <div className="lg:pt-6">
              {tag && <p className="eyebrow mb-4 text-gold-deep">{tag}</p>}
              <h1 className="font-serif text-4xl leading-[1] tracking-tight md:text-6xl">{product.name}</h1>
              {(wine?.region || brand?.origin) && <p className="mt-4 text-[11px] tracking-[0.22em] text-ink/50 uppercase">{wine?.region ?? brand?.origin}</p>}
              {product.description && <Prose data={product.description} className="mt-8 text-base" />}
              <div className="mt-10 border-t border-border pt-8">
                {options.length > 0 ? (
                  <BuyBox
                    options={options}
                    locale={locale}
                    t={{ ...s.buy, outOfStock: s.outOfStock, minus: t.cart.minus, plus: t.cart.plus }}
                  />
                ) : (
                  <p className="text-sm text-ink/50">{s.unavailable}</p>
                )}
              </div>
              {facts.length > 0 && (
                <dl className="mt-12 divide-y divide-border border-y border-border">
                  {facts.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[10rem_1fr] gap-4 py-3 text-sm">
                      <dt className="eyebrow pt-0.5 text-ink/50">{label}</dt>
                      <dd className="font-light">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </Container>
      </section>
      {related.length > 0 && (
        <section className="border-t border-border/60 py-20">
          <Container>
            <p className="eyebrow mb-4 text-gold-deep">{s.related.eyebrow}</p>
            <h2 className="mb-10 font-serif text-3xl tracking-tight md:text-5xl">
              {s.related.titleA} <em className="text-gold-deep italic">{s.related.titleB}</em>
            </h2>
            <div className="grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} locale={locale} t={s} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}

// `slug` is only known at request time, so the whole product streams behind Suspense.
export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Product params={params} />
    </Suspense>
  );
}
