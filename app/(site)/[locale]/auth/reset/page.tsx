import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { AuthShell } from '@/modules/customers/components/auth-shell';
import { ResetForm } from '@/modules/customers/components/auth-forms';

type Props = PageProps<'/[locale]/auth/reset'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = await getDictionary(locale);
  return { title: `${auth.resetTitle} · Golden Grape`, robots: { index: false } };
}

async function Form({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const { token } = await searchParams;
  const { auth: t, form } = await getDictionary(locale);
  return (
    <>
      <p className="eyebrow mb-3 text-gold-deep">{t.eyebrow}</p>
      <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{t.resetTitle}</h1>
      <p className="mt-3 mb-10 text-sm text-ink/60">{t.resetSubtitle}</p>
      <ResetForm t={t} m={form} token={typeof token === 'string' ? token : ''} locale={locale} />
    </>
  );
}

export default async function ResetPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth: t } = await getDictionary(locale);
  return (
    <AuthShell eyebrow={t.panelEyebrow} title={t.panelTitle} subtitle={t.panelText}>
      <Suspense fallback={<div className="min-h-[360px]" />}>
        <Form locale={locale} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
