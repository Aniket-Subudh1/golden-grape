import { CalendarCheck, Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { type Dictionary, getDictionary, interpolate, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { slotLabel } from '@/lib/time';
import { currentCustomer } from '@/modules/customers/service';
import { historyOf } from '@/modules/sales/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/orders'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.ordersTitle} · Golden Grape`, robots: { index: false } };
}

const CLOSED = ['completed', 'cancelled', 'refunded', 'rejected'];

function Row({ href, number, when, status, closed, right }: { href: string; number: string; when: string; status: string; closed: boolean; right: string }) {
  return (
    <li>
      <Link href={href} className="group flex flex-wrap items-center gap-x-6 gap-y-2 py-5 transition hover:bg-champagne/30 sm:px-4">
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl group-hover:text-gold-deep">{when}</span>
          <span className="mt-0.5 block text-xs text-ink/50 tabular-nums">{number}</span>
        </span>
        <span className={cn('rounded-full px-3 py-1 text-[10px] tracking-[0.18em] uppercase', closed ? 'bg-champagne text-ink/60' : 'bg-gold/15 text-gold-deep')}>{status}</span>
        <span className="w-24 text-right text-sm tabular-nums">{right}</span>
      </Link>
    </li>
  );
}

async function History({ locale, t, order: o }: { locale: Locale; t: Dictionary['account']; order: Dictionary['order'] }) {
  const customer = await currentCustomer();
  if (!customer) return null; // the layout shows the signed-out panel
  const { orders, reservations } = await historyOf(await getPayloadClient(), customer);
  const href = (id: string) => localePath(locale, `/order/${id}`);
  return (
    <div className="space-y-16">
      <section>
        <h2 className="mb-6 flex items-center gap-3 font-serif text-3xl">
          <Package className="h-5 w-5 text-gold-deep" /> {t.ordersTitle}
        </h2>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center border border-border px-6 py-12 text-center">
            <p className="max-w-sm text-sm text-ink/60">{t.noOrders}</p>
            <Button asChild className="mt-6">
              <Link href={localePath(locale, '/shop')}>{t.toShop}</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {orders.map((x) => (
              <Row
                key={x.id}
                href={href(x.id)}
                number={`${x.number} · ${o.modes[(x.mode ?? 'pickup') as keyof typeof o.modes] ?? ''}`}
                when={slotLabel(x.slot ?? {}, locale, 'short')}
                status={o.status[(x.status ?? 'pending') as keyof typeof o.status]}
                closed={CLOSED.includes(x.status ?? '')}
                right={formatMoney(x.totals?.totalCents ?? 0, locale)}
              />
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-6 flex items-center gap-3 font-serif text-3xl">
          <CalendarCheck className="h-5 w-5 text-gold-deep" /> {t.orders.reservations}
        </h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-ink/60">{t.orders.noReservations}</p>
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {reservations.map((r) => (
              <Row
                key={r.id}
                href={href(r.id)}
                number={r.number ?? ''}
                when={slotLabel({ date: r.slot?.date, from: r.slot?.from }, locale, 'short')}
                status={o.reservationStatus[(r.status ?? 'pending') as keyof typeof o.reservationStatus]}
                closed={CLOSED.includes(r.status ?? '')}
                right={interpolate(r.guests === 1 ? t.orders.guests_one : t.orders.guests_other, { count: r.guests ?? 1 })}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function OrdersPage({ params }: PageProps<'/[locale]/account/orders'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account: t, order } = await getDictionary(locale);
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <History locale={locale} t={t} order={order} />
    </Suspense>
  );
}
