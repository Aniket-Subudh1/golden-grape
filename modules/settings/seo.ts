import { appUrl } from '@/lib/env';
import type { getSettings } from './service';

// schema.org LocalBusiness for the home and contact pages (M2.2 T5). "LiquorStore" is the LocalBusiness type for a
// wine shop (schema.org has no WineStore). Hours and address come from Business settings.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function localBusinessJsonLd({ business: b, hours }: Awaited<ReturnType<typeof getSettings>>, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LiquorStore',
    name: b.name,
    url: `${appUrl()}${url}`,
    image: `${appUrl()}/brand/home-store/Home_0.jpg`,
    logo: `${appUrl()}/brand/logo-light.png`,
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(b.email ? { email: b.email } : {}),
    address: { '@type': 'PostalAddress', streetAddress: b.street, postalCode: b.postalCode, addressLocality: b.city, addressCountry: 'LU' },
    ...(typeof b.latitude === 'number' && typeof b.longitude === 'number' ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } } : {}),
    openingHoursSpecification: hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[Number(h.day)], opens: h.open, closes: h.close })),
    sameAs: [b.instagram, b.facebook].filter(Boolean),
    priceRange: '€€',
  };
}
