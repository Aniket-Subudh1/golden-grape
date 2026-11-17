import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffPage } from '@/components/staff/page';
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
    <StaffPage
      title={t.receivePage.title}
      back={{ href: '/staff', label: t.back }}
      width="wide"
      className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
    >
      {orders.length === 0 ? (
        <p className="border-border text-ink/55 col-span-full rounded-xl border border-dashed p-6 text-center text-sm">
          {t.receivePage.none}
        </p>
      ) : (
        orders.map((po) => {
          const due = po.expectedAt ? today(new Date(po.expectedAt)) : null;
          return (
            <Link
              key={po.id}
              href={`/staff/receive/${po.id}`}
              className="gg-card flex items-center justify-between gap-3 px-4 py-4 transition hover:-translate-y-px hover:shadow-md"
            >
              <span className="min-w-0">
                <span className="block truncate">{po.supplier}</span>
                <span className="text-ink/55 text-xs">
                  {po.number}
                  {po.status === 'partly_received' && ` · ${t.receivePage.partly}`}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs">
                <span
                  className={`block ${due && due < day ? 'text-red-700' : due === day ? 'text-amber-700' : 'text-ink/60'}`}
                >
                  {due ? date.format(new Date(po.expectedAt!)) : '—'}
                </span>
                <span className="text-ink/55">{interpolate(t.receivePage.remaining, { n: po.remaining })}</span>
              </span>
            </Link>
          );
        })
      )}
    </StaffPage>
  );
}
