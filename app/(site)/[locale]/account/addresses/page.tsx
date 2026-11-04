import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { AddressBook } from '@/modules/customers/components/account-forms';
import { currentCustomer } from '@/modules/customers/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/addresses'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.nav.addresses} · Golden Grape`, robots: { index: false } };
}

async function Book({ locale }: { locale: Locale }) {
  const [customer, { account: t, form }] = await Promise.all([currentCustomer(), getDictionary(locale)]);
  if (!customer) return null;
  return (
    <>
      <h2 className="font-serif text-3xl">{t.addressesTitle}</h2>
      <p className="mt-2 mb-8 text-sm text-ink/60">{t.addressesText}</p>
      {/* Keyed by the saved list, so the book starts fresh after every change. */}
      <AddressBook key={JSON.stringify(customer.addresses ?? [])} t={t} m={form} addresses={customer.addresses ?? []} />
    </>
  );
}

export default async function AddressesPage({ params }: PageProps<'/[locale]/account/addresses'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Suspense fallback={null}>
      <Book locale={locale} />
    </Suspense>
  );
}
