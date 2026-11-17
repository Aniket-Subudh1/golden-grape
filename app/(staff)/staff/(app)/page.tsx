import type { Metadata } from 'next';
import { SignOut } from '@/components/staff/sign-out';
import { Tile } from '@/components/staff/tile';
import { TopBar } from '@/components/staff/top-bar';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { today } from '@/lib/time';
import { lowStockCount } from '@/modules/inventory/service';
import { staffDay } from '@/modules/sales/service';
import { canOpen, requireStaff, SCREENS } from '../session';

export const instant = false;
export const metadata: Metadata = { title: 'Accueil' };

/** Home (05 §5): today's orders and open reservations for sales, low stock and expected deliveries for stock. */
export default async function StaffHome() {
  const { user, t } = await requireStaff('home');
  const payload = await getPayloadClient();
  const day = today();
  const [sales, stock] = await Promise.all([canOpen(user, 'orders'), canOpen(user, 'stock')]);
  const [figures, low] = await Promise.all([sales ? staffDay(payload, day) : null, stock ? lowStockCount(payload) : null]);
  const waiting = figures ? (figures.byStatus.pending ?? 0) + (figures.byStatus.awaiting_payment ?? 0) : 0;
  const reorder = await canOpen(user, 'reorder');

  return (
    <>
      <TopBar title={interpolate(t.home.hello, { name: user.name.split(' ')[0] })} action={<SignOut label={t.signOut} />} />
      <main className="grid grid-cols-2 gap-3 p-4">
        {figures && (
          <>
            <Tile href={SCREENS.orders.href} label={t.home.ordersToday} value={figures.orders} hint={interpolate(t.home.ordersHint, { waiting, ready: figures.byStatus.ready ?? 0 })} tone={waiting > 0 ? 'warning' : 'neutral'} />
            <Tile href={SCREENS.orders.href} label={t.home.reservations} value={figures.reservations} hint={t.home.reservationsHint} />
          </>
        )}
        {low !== null && (
          <Tile
            href={reorder ? SCREENS.reorder.href : '/admin/collections/stockLevels?where[lowStock][equals]=true'}
            label={t.home.lowStock}
            value={low}
            hint={low > 0 ? t.home.lowStockHint : t.home.lowStockNone}
            tone={low > 0 ? 'warning' : 'neutral'}
          />
        )}
      </main>
    </>
  );
}
