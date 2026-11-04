import { ArrowRight, MapPin, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { getDictionary, isLocale, type Locale, LOCALE_NAMES, localePath } from '@/lib/i18n';
import { currentCustomer } from '@/modules/customers/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.eyebrow} · Golden Grape`, robots: { index: false } };
}

const card = 'flex flex-col border border-border bg-bone p-6 md:p-8';

async function Overview({ locale }: { locale: Locale }) {
  const [customer, { account: t }] = await Promise.all([currentCustomer(), getDictionary(locale)]);
  if (!customer) return null;
  const address = customer.addresses?.find((a) => a.isDefault) ?? customer.addresses?.[0];
  const base = localePath(locale, '/account');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <article className={card}>
        <UserRound className="h-5 w-5 text-gold-deep" />
        <h2 className="mt-4 font-serif text-2xl">{t.nav.profile}</h2>
        <dl className="mt-4 flex-1 space-y-1 text-sm font-light text-ink/70">
          <dd>{customer.email}</dd>
          {customer.phone && <dd>{customer.phone}</dd>}
          <dd>{LOCALE_NAMES[customer.locale]}</dd>
          {customer.vatNumber && <dd>{customer.vatNumber}</dd>}
        </dl>
        <Link href={`${base}/profile`} className="eyebrow mt-6 inline-flex items-center gap-2 text-gold-deep">
          {t.edit} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </article>
      <article className={card}>
        <MapPin className="h-5 w-5 text-gold-deep" />
        <h2 className="mt-4 font-serif text-2xl">{t.defaultAddress}</h2>
        <p className="mt-4 flex-1 text-sm leading-relaxed font-light text-ink/70">
          {address ? (
            <>
              {address.line1}
              {address.line2 && <>, {address.line2}</>}
              <br />
              {address.postalCode} {address.city} · {address.country}
            </>
          ) : (
            t.noAddress
          )}
        </p>
        <Link href={`${base}/addresses`} className="eyebrow mt-6 inline-flex items-center gap-2 text-gold-deep">
          {address ? t.manageAddresses : t.addAddress} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </article>
      <article className="flex flex-col items-start gap-5 bg-ink p-6 text-bone md:col-span-2 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="eyebrow text-gold">{t.shopEyebrow}</p>
          <p className="mt-2 font-serif text-2xl font-light">{t.shopText}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold">
            <Link href={localePath(locale, '/shop')}>{t.toShop}</Link>
          </Button>
          <Button asChild variant="gold">
            <Link href={localePath(locale, '/snack')}>{t.toCounter}</Link>
          </Button>
        </div>
      </article>
    </div>
  );
}

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Suspense fallback={null}>
      <Overview locale={locale} />
    </Suspense>
  );
}
