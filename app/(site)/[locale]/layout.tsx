import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Footer } from '@/components/site/footer';
import { Nav } from '@/components/site/nav';
import type { NavItem } from '@/components/site/nav-link';
import { Toaster } from '@/components/ui/sonner';
import { appUrl } from '@/lib/env';
import { type Dictionary, getDictionary, isLocale, type Locale, LOCALES, localePath } from '@/lib/i18n';
import { getFooter, getHeader } from '@/modules/cms/service';
import { getSettings } from '@/modules/settings/service';
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

async function SiteNav({ locale, t }: { locale: Locale; t: Dictionary['nav'] }) {
  const header = await getHeader(locale);
  return (
    <Nav
      locale={locale}
      items={(header.navItems ?? []).map(toItem(locale))}
      labels={{ openMenu: t.openMenu, closeMenu: t.closeMenu, language: t.language }}
    />
  );
}

async function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [footer, { business }] = await Promise.all([getFooter(locale), getSettings()]);
  return (
    <Footer
      t={t.footer}
      tagline={footer.tagline}
      columns={(footer.columns ?? []).map((col) => ({ title: col.title, items: (col.links ?? []).map(toItem(locale)) }))}
      contactTitle={t.footer.colContact}
      business={business}
      legal={footer.legal.map((doc) => ({ label: doc.title, href: localePath(locale, `/legal/${doc.slug}`) }))}
    />
  );
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-bone text-ink">
        <Suspense fallback={null}>
          <SiteNav locale={locale} t={t.nav} />
        </Suspense>
        <main>{children}</main>
        <Suspense fallback={null}>
          <SiteFooter locale={locale} t={t} />
        </Suspense>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
