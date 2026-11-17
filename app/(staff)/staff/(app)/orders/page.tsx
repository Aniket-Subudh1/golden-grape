import type { Metadata } from 'next';
import { StaffDecisions } from '@/components/staff/decisions';
import { TopBar } from '@/components/staff/top-bar';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { slotLabel, today } from '@/lib/time';
import type { Order } from '@/payload-types';
import { decideReservation, transitionOrder } from '@/modules/sales/actions';
import { decisionsFor, reservationDecisions } from '@/modules/sales/admin/decisions';
import { langOf, salesText } from '@/modules/sales/admin/text';
import { MODE_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type PaymentStatus, RESERVATION_STATUS_LABELS } from '@/modules/sales/collections';
import { ORDER_ROLES, type ReservationStatus } from '@/modules/sales/order-states';
import { staffAgenda } from '@/modules/sales/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Commandes' };

const card = 'space-y-3 rounded-xl border border-border bg-white/70 p-4';
const badge = 'eyebrow rounded-full border border-border px-2 py-0.5 text-[10px]';

/**
 * Today's and upcoming orders and table reservations (M3.1 T5), soonest first, each with the moves the admin offers
 * (the same decisions and actions: modules/sales/admin/decisions.ts). The details stay one tap away in the admin.
 */
export default async function OrdersPage() {
  const { user, locale, t } = await requireStaff('orders');
  const payload = await getPayloadClient();
  const { orders, reservations } = await staffAgenda(payload, today());
  const lang = langOf(locale);
  const s = salesText(lang);
  // Moving orders is the sales role's, as in the admin (a manager sees them, sales staff act on them).
  const acts = hasRole(user, ORDER_ROLES);
  const money = (cents: number) => formatMoney(cents, locale);
  return (
    <>
      <TopBar title={t.orders.title} back={{ href: '/staff', label: t.back }} />
      <main className="space-y-6 p-4">
        <section className="space-y-3">
          <h2 className="eyebrow text-ink/60">{t.orders.orders}</h2>
          {orders.length === 0 && <p className="text-sm text-ink/55">{t.orders.noOrders}</p>}
          {orders.map((o: Order) => (
            <article key={o.id} className={card} data-order={o.number}>
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-xl">{o.contact?.name}</p>
                  <p className="text-xs text-ink/55">
                    {o.number} · {MODE_LABELS[o.mode ?? 'pickup'][locale]} · {slotLabel(o.slot ?? {}, locale, 'short')}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block tabular-nums">{money(o.totals?.totalCents ?? 0)}</span>
                  <span className="text-xs text-ink/55">{PAYMENT_STATUS_LABELS[(o.payment?.status ?? 'none') as PaymentStatus][locale]}</span>
                </span>
              </header>
              <p className="flex flex-wrap items-center gap-2">
                <span className={badge}>{ORDER_STATUS_LABELS[o.status ?? 'pending'][locale]}</span>
                <a href={`/admin/collections/orders/${o.id}`} className="eyebrow text-gold-deep">
                  {t.orders.details}
                </a>
              </p>
              {acts && <StaffDecisions action={transitionOrder} target={{ order: o.id }} decisions={decisionsFor(o, s, [], [], money)} text={s.decide} />}
            </article>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="eyebrow text-ink/60">{t.orders.reservations}</h2>
          {reservations.length === 0 && <p className="text-sm text-ink/55">{t.orders.noReservations}</p>}
          {reservations.map((r) => {
            const preorder = typeof r.preorder === 'object' && r.preorder ? r.preorder : null;
            return (
              <article key={r.id} className={card} data-reservation={r.number}>
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-xl">{r.contact?.name}</p>
                    <p className="text-xs text-ink/55">
                      {r.number} · {slotLabel(r.slot ?? {}, locale, 'short')} · {r.guests} {t.orders.guests}
                    </p>
                  </div>
                  {preorder && <span className="tabular-nums">{money(preorder.totals?.totalCents ?? 0)}</span>}
                </header>
                <p className="flex flex-wrap items-center gap-2">
                  <span className={badge}>{RESERVATION_STATUS_LABELS[r.status ?? 'pending'][locale]}</span>
                  <a href={`/admin/collections/reservations/${r.id}`} className="eyebrow text-gold-deep">
                    {t.orders.details}
                  </a>
                </p>
                {acts && <StaffDecisions action={decideReservation} target={{ reservation: r.id }} decisions={reservationDecisions((r.status ?? 'pending') as ReservationStatus, preorder, lang)} text={s.decide} />}
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}
