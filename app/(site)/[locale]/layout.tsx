import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/site/footer';
import { Nav } from '@/components/site/nav';
import { Toaster } from '@/components/ui/sonner';
import { appUrl } from '@/lib/env';
import { getDictionary, isLocale, LOCALES, localePath } from '@/lib/i18n';
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

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const href = (path: string) => localePath(locale, path);
  // Shop and Snack render as text until their pages exist (M2.2).
  const shop = { label: t.nav.shop };
  const snack = { label: t.nav.snack };
  const catering = { label: t.nav.catering, href: href('/catering') };
  const events = { label: t.nav.events, href: href('/events') };

  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-bone text-ink">
        <Nav
          locale={locale}
          items={[shop, snack, catering, events, { label: t.nav.maison, href: href('/maison') }, { label: t.nav.contact, href: href('/contact') }]}
          labels={{ openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu }}
        />
        <main>{children}</main>
        <Footer
          t={t.footer}
          columns={[
            {
              title: t.footer.colMaison,
              items: [
                { label: t.footer.links.history, href: href('/maison') },
                { label: t.footer.links.shop },
                { label: t.footer.links.counter },
                { label: t.footer.links.contact, href: href('/contact') },
              ],
            },
            {
              title: t.footer.colServices,
              items: [
                { label: t.footer.links.catering, href: href('/catering') },
                { label: t.footer.links.events, href: href('/events') },
                { label: t.footer.links.happy, href: href('/events') },
                { label: t.footer.links.gifts },
              ],
            },
          ]}
        />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
