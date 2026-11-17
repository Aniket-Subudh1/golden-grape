import { ChevronRight, PackageCheck, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffPage } from '@/components/staff/page';
import { Empty } from '@/components/staff/tabs';
import { cn } from '@/lib/cn';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { today } from '@/lib/time';
import { openPurchaseOrders } from '@/modules/purchasing/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Réception' };

/** Orders expecting goods, soonest first (M3.1 T4): who, when (late in red), how much is in already. */
export default async function ReceiveList() {
  const { locale, t } = await requireStaff('receive');
  const orders = await openPurchaseOrders(await getPayloadClient());
  const day = today();
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Luxembourg',
  });
  const r = t.receivePage;
  return (
    <StaffPage title={r.title} subtitle={t.receiveScreen.hint} back={{ href: '/staff', label: t.back }} width="wide">
      {orders.length === 0 ? (
        <Empty icon={<PackageCheck />} text={r.none} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((po) => {
            const due = po.expectedAt ? today(new Date(po.expectedAt)) : null;
            const late = due !== null && due < day;
            const received = po.ordered - po.remaining;
            const pct = po.ordered > 0 ? Math.round((received / po.ordered) * 100) : 0;
            return (
              <li key={po.id}>
                <Link
                  href={`/staff/receive/${po.id}`}
                  className="gg-card block space-y-3 p-4 transition hover:shadow-md"
                >
                  <span className="flex items-start gap-3">
                    <span className="bg-champagne text-gold-deep grid h-10 w-10 shrink-0 place-items-center rounded-[10px]">
                      <Truck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{po.supplier || po.number}</span>
                      {po.supplier && <span className="text-ink/55 block text-xs">{po.number}</span>}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                        late
                          ? 'bg-red-50 text-red-700 ring-red-200'
                          : due === day
                            ? 'bg-amber-50 text-amber-800 ring-amber-200'
                            : 'text-ink/65 ring-border bg-[#e7ecf3]',
                      )}
                    >
                      {late
                        ? r.late
                        : due === day
                          ? r.today
                          : due
                            ? interpolate(r.due, { date: date.format(new Date(po.expectedAt!)) })
                            : r.noDate}
                    </span>
                    <ChevronRight className="text-ink/35 mt-0.5 h-4 w-4 shrink-0" />
                  </span>
                  <span className="block">
                    <span className="mb-1.5 flex justify-between text-xs">
                      <span className="text-ink/70">{interpolate(r.progress, { received, ordered: po.ordered })}</span>
                      <span className="text-ink/55">{interpolate(r.remaining, { n: po.remaining })}</span>
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-[#e7ecf3]">
                      <span className="bg-gold block h-full rounded-full" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </StaffPage>
  );
}
