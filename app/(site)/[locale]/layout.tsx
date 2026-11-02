import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { appUrl } from '@/lib/env';
import { isLocale, LOCALES } from '@/lib/i18n';
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
  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
