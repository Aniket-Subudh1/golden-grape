import type { Metadata } from 'next';
import Link from 'next/link';
import { TopBar } from '@/components/staff/top-bar';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { today } from '@/lib/time';
import { openPurchaseOrders } from '@/modules/purchasing/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Réception' };

/** Orders expecting goods, soonest first (M3.1 T4). */
export default async function ReceiveList() {
  const { locale, t } = await requireStaff('receive');
  const orders = await openPurchaseOrders(await getPayloadClient());
  const day = today();
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Luxembourg' });
  return (
    <>
      <TopBar title={t.receivePage.title} back={{ href: '/staff', label: t.back }} />
      <main className="space-y-2 p-4">
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink/55">{t.receivePage.none}</p>
        ) : (
          orders.map((po) => {
            const due = po.expectedAt ? today(new Date(po.expectedAt)) : null;
            return (
              <Link key={po.id} href={`/staff/receive/${po.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/70 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{po.supplier}</span>
                  <span className="text-xs text-ink/55">
                    {po.number}
                    {po.status === 'partly_received' && ` · ${t.receivePage.partly}`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className={`block ${due && due < day ? 'text-red-700' : due === day ? 'text-amber-700' : 'text-ink/60'}`}>{due ? date.format(new Date(po.expectedAt!)) : '—'}</span>
                  <span className="text-ink/55">{interpolate(t.receivePage.remaining, { n: po.remaining })}</span>
                </span>
              </Link>
            );
          })
        )}
      </main>
    </>
  );
}
