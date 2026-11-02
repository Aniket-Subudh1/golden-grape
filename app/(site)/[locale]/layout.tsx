import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CookieConsent } from '@/components/site/cookie-consent';
import { Footer } from '@/components/site/footer';
import { Nav } from '@/components/site/nav';
import type { NavItem } from '@/components/site/nav-link';
import { Toaster } from '@/components/ui/sonner';
import { appUrl } from '@/lib/env';
import { type Dictionary, getDictionary, isLocale, type Locale, LOCALES, localePath } from '@/lib/i18n';
import { groupedHours } from '@/lib/time';
import { getFooter, getHeader } from '@/modules/cms/service';
import { directionsUrl, getSettings } from '@/modules/settings/service';
import '../../globals.css';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export const metadata: Metadata = { metadataBase: new URL(appUrl()) };

// CMS links are stored without the language; an empty href renders as text (page not online yet).
const toItem = (locale: Locale) => (link: { label: string; href?: string | null }): NavItem => ({
  label: link.label,
  href: link.href ? localePath(locale, link.href) : undefined,
});

async function SiteNav({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [header, { business }] = await Promise.all([getHeader(locale), getSettings()]);
  return (
    <Nav
      locale={locale}
      items={(header.navItems ?? []).map(toItem(locale))}
      labels={{ openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu, language: t.nav.language, phone: t.contactPage.info.phone }}
      phone={business?.phone}
      instagram={business?.instagram}
    />
  );
}

async function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [footer, { business, hours }] = await Promise.all([getFooter(locale), getSettings()]);
  return (
    <Footer
      t={t.footer}
      tagline={footer.tagline}
      columns={(footer.columns ?? []).map((col) => ({ title: col.title, items: (col.links ?? []).map(toItem(locale)) }))}
      business={business}
      hours={groupedHours(hours, locale)}
      hoursLabel={t.store.hoursLabel}
      directions={{ label: t.store.directions, href: directionsUrl(business) }}
      reserve={{ label: t.happyHour.reserve, href: localePath(locale, '/contact') }}
      // The prototype's two labels stay as plain text until the real legal pages are published (DEP-05).
      legal={
        footer.legal.length > 0
          ? footer.legal.map((doc) => ({ label: doc.title, href: localePath(locale, `/legal/${doc.slug}`) }))
          : [{ label: t.footer.legal }, { label: t.footer.privacy }]
      }
    />
  );
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`}>
      <body id="top" className="bg-bone text-ink">
        <Suspense fallback={null}>
          <SiteNav locale={locale} t={t} />
        </Suspense>
        <main>{children}</main>
        <Suspense fallback={null}>
          <SiteFooter locale={locale} t={t} />
        </Suspense>
        <CookieConsent t={t.cookies} />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
