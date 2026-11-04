import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { PasswordForm, ProfileForm } from '@/modules/customers/components/account-forms';
import { currentCustomer } from '@/modules/customers/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/profile'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.nav.profile} · Golden Grape`, robots: { index: false } };
}

async function Forms({ locale }: { locale: Locale }) {
  const [customer, { account: t, form }] = await Promise.all([currentCustomer(), getDictionary(locale)]);
  if (!customer) return null;
  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_20rem] lg:gap-20">
      <div>
        <h2 className="mb-8 font-serif text-3xl">{t.profileTitle}</h2>
        <ProfileForm t={t} m={form} profile={customer} />
        <h2 className="mt-20 mb-8 border-t border-border pt-12 font-serif text-3xl">{t.passwordTitle}</h2>
        <PasswordForm t={t} m={form} />
      </div>
      <aside className="h-fit bg-champagne/40 p-6 text-sm leading-relaxed font-light text-ink/70">
        <p className="eyebrow mb-3 text-gold-deep">{t.emailTitle}</p>
        <p className="text-ink">{customer.email}</p>
        <p className="mt-3">{t.emailNote}</p>
      </aside>
    </div>
  );
}

export default async function ProfilePage({ params }: PageProps<'/[locale]/account/profile'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Suspense fallback={null}>
      <Forms locale={locale} />
    </Suspense>
  );
}
