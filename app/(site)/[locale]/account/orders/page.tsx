import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getDictionary, isLocale, localePath } from '@/lib/i18n';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/orders'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.ordersTitle} · Golden Grape`, robots: { index: false } };
}

// Orders are placed from M2.3 (checkout); until then every customer's history is empty. The account menu links here
// only once a customer has orders.
export default async function OrdersPage({ params }: PageProps<'/[locale]/account/orders'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account: t } = await getDictionary(locale);
  return (
    <div className="flex flex-col items-center border border-border px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/15">
        <Package className="h-6 w-6 text-gold-deep" />
      </span>
      <h2 className="mt-6 font-serif text-3xl">{t.ordersTitle}</h2>
      <p className="mt-3 max-w-sm text-sm text-ink/60">{t.noOrders}</p>
      <Button asChild className="mt-8">
        <Link href={localePath(locale, '/shop')}>{t.toShop}</Link>
      </Button>
    </div>
  );
}
