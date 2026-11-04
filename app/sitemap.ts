import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { appUrl } from '@/lib/env';
import { DEFAULT_LOCALE, LOCALES, localePath } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { productSlugs } from '@/modules/catalogue/service';
import { getFooter, getPage } from '@/modules/cms/service';
import { publishedEventSlugs } from '@/modules/events/service';

// Every public page in the four languages, each entry listing its translations (M2.2 T5). Read at request time:
// products and events change without a deploy.

const STATIC = ['/', '/shop', '/snack', '/catering', '/events', '/contact'];

function entry(path: string, lastModified?: string | Date): MetadataRoute.Sitemap {
  const languages = Object.fromEntries([...LOCALES.map((l) => [l, `${appUrl()}${localePath(l, path)}`]), ['x-default', `${appUrl()}${localePath(DEFAULT_LOCALE, path)}`]]);
  return LOCALES.map((l) => ({ url: `${appUrl()}${localePath(l, path)}`, lastModified, alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const payload = await getPayloadClient();
  const [products, events, maison, footer] = await Promise.all([productSlugs(payload), publishedEventSlugs(), getPage('maison', DEFAULT_LOCALE), getFooter(DEFAULT_LOCALE)]);
  return [
    ...STATIC.flatMap((path) => entry(path)),
    ...(maison ? entry('/maison', maison.updatedAt) : []),
    ...products.flatMap((p) => entry(`/shop/${p.slug}`, p.updatedAt)),
    ...events.flatMap((e) => entry(`/events/${e.slug}`, e.updatedAt)),
    ...footer.legal.flatMap((doc) => entry(`/legal/${doc.slug}`)),
  ];
}
