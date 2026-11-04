import { appUrl } from '@/lib/env';

// Structured data for product pages (M2.2 T5): schema.org Product + Offer, and the breadcrumb trail.

const absolute = (path: string) => (path.startsWith('http') ? path : `${appUrl()}${path}`);
const euros = (cents: number) => (cents / 100).toFixed(2);

export function productJsonLd(p: {
  name: string;
  description?: string | null;
  url: string;
  images: string[];
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  priceCents: number;
  inStock: boolean;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    image: p.images.map(absolute),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    ...(p.category ? { category: p.category } : {}),
    offers: {
      '@type': 'Offer',
      url: absolute(p.url),
      price: euros(p.priceCents),
      priceCurrency: 'EUR',
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(item.path) })),
  };
}
