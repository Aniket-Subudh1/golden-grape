import { CalendarDays, ClipboardList, TriangleAlert, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ICONS } from '@/components/staff/icons';
import { SignOut } from '@/components/staff/sign-out';
import { Tile } from '@/components/staff/tile';
import { LanguageMenu } from '@/components/staff/language';
import { StaffPage } from '@/components/staff/page';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { today } from '@/lib/time';
import { lowStockCount } from '@/modules/inventory/service';
import { dueBy } from '@/modules/purchasing/service';
import { staffDay } from '@/modules/sales/service';
import { SCREENS } from '../screens';
import { canOpen, navFor, requireStaff } from '../session';

export const instant = false;
export const metadata: Metadata = { title: 'Accueil' };

/** Home (05 §5): today's orders and open reservations for sales, low stock and expected deliveries for stock. */
export default async function StaffHome() {
  const { user, locale, t } = await requireStaff('home');
  const payload = await getPayloadClient();
  const day = today();
  const [sales, stock] = await Promise.all([canOpen(user, 'orders'), canOpen(user, 'stock')]);
  const [figures, low] = await Promise.all([
    sales ? staffDay(payload, day) : null,
    stock ? lowStockCount(payload) : null,
  ]);
  const waiting = figures ? (figures.byStatus.pending ?? 0) + (figures.byStatus.awaiting_payment ?? 0) : 0;
  const [reorder, receive] = await Promise.all([canOpen(user, 'reorder'), canOpen(user, 'receive')]);
  const deliveries = receive ? await dueBy(payload, day) : null;
  const allowed = await navFor(user);

  // Quick actions: the screens of the day's work this role opens (navigation lives in the bar or the sidebar).
  const quick = (['scan', 'sale', 'receive', 'count'] as const).filter((screen) => allowed.includes(screen));
  const titles = { scan: t.scanPage.title, sale: t.sale.title, receive: t.receivePage.title, count: t.countPage.title };

  return (
    <StaffPage
      title={interpolate(t.home.hello, { name: user.name.split(' ')[0] })}
      subtitle={t.home.subtitle}
      width="wide"
      action={
        <span className="flex items-center gap-1 md:hidden">
          <LanguageMenu current={locale} label={t.login.language} account tone="dark" />
          <SignOut label={t.signOut} />
        </span>
      }
      className="space-y-6 md:space-y-8"
    >
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {figures && (
          <>
            <Tile
              href={SCREENS.orders.href}
              icon={<ClipboardList />}
              label={t.home.ordersToday}
              value={figures.orders}
              hint={interpolate(t.home.ordersHint, { waiting, ready: figures.byStatus.ready ?? 0 })}
              tone={waiting > 0 ? 'warning' : 'neutral'}
            />
            <Tile
              href={SCREENS.orders.href}
              icon={<CalendarDays />}
              label={t.home.reservations}
              value={figures.reservations}
              hint={t.home.reservationsHint}
            />
          </>
        )}
        {low !== null && (
          <Tile
            href={reorder ? SCREENS.reorder.href : '/admin/collections/stockLevels?where[lowStock][equals]=true'}
            icon={<TriangleAlert />}
            label={t.home.lowStock}
            value={low}
            hint={low > 0 ? t.home.lowStockHint : t.home.lowStockNone}
            tone={low > 0 ? 'warning' : 'neutral'}
          />
        )}
        {deliveries !== null && (
          <Tile
            href={SCREENS.receive.href}
            icon={<Truck />}
            label={t.home.deliveries}
            value={deliveries}
            hint={t.home.deliveriesHint}
            tone={deliveries > 0 ? 'warning' : 'neutral'}
          />
        )}
      </div>
      {quick.length > 0 && (
        <section>
          <h2 className="eyebrow text-ink/55 mb-3">{t.home.quick}</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {quick.map((screen) => {
              const Icon = ICONS[screen];
              return (
                <Link
                  key={screen}
                  href={SCREENS[screen].href}
                  className="gg-card flex items-center gap-3 p-4 text-sm font-medium transition hover:-translate-y-px hover:shadow-md"
                >
                  <span className="bg-ink grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  {titles[screen]}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </StaffPage>
  );
}
