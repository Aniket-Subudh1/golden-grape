import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  ExternalLink,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffDecisions } from '@/components/staff/decisions';
import { StaffPage } from '@/components/staff/page';
import { Empty, StaffTabs } from '@/components/staff/tabs';
import { hasRole } from '@/lib/access';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { slotLabel, today } from '@/lib/time';
import { decideReservation, transitionOrder } from '@/modules/sales/actions';
import { decisionsFor, reservationDecisions } from '@/modules/sales/admin/decisions';
import { langOf, salesText } from '@/modules/sales/admin/text';
import {
  MODE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  RESERVATION_STATUS_LABELS,
} from '@/modules/sales/collections';
import { ORDER_ROLES, type OrderStatus, type ReservationStatus } from '@/modules/sales/order-states';
import { staffAgenda } from '@/modules/sales/service';
import type { Order } from '@/payload-types';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Commandes' };

/** The colour of a stage: amber waits for someone, blue is under way, green is ready or accepted. */
const TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  awaiting_payment: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-800 ring-sky-200',
  out_for_delivery: 'bg-violet-50 text-violet-800 ring-violet-200',
  ready: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};
const MODE_ICONS: Record<string, typeof Store> = {
  pickup: ShoppingBag,
  delivery: Truck,
  instore: Store,
  b2b: Building2,
};

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone] ?? 'text-ink/70 ring-border bg-[#e7ecf3]',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** A card's head: the kind's icon, who, the reference and when; the amount and whether it is paid on the right. */
function Head({
  icon,
  name,
  meta,
  when,
  amount,
  paid,
}: {
  icon: ReactNode;
  name: string;
  meta: string;
  when: string;
  amount?: string;
  paid?: { label: string; ok: boolean };
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="text-gold-deep bg-champagne grid h-10 w-10 shrink-0 place-items-center rounded-[10px] [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{name}</p>
        <p className="text-ink/55 truncate text-xs">{meta}</p>
        <p className="text-ink/70 mt-1 flex items-center gap-1 text-xs">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {when}
        </p>
      </div>
      {amount && (
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums">{amount}</p>
          {paid && (
            <p className={cn('text-xs font-medium', paid.ok ? 'text-emerald-700' : 'text-amber-700')}>{paid.label}</p>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * Today's and upcoming orders and table reservations (M3.1 T5), soonest first, in two tabs. Each card carries the moves
 * the admin offers (the same decisions and actions: modules/sales/admin/decisions.ts); the details stay one tap away.
 */
export default async function OrdersPage({ searchParams }: PageProps<'/staff/orders'>) {
  const { user, locale, t } = await requireStaff('orders');
  const { tab } = await searchParams;
  const payload = await getPayloadClient();
  const { orders, reservations } = await staffAgenda(payload, today());
  const lang = langOf(locale);
  const s = salesText(lang);
  const acts = hasRole(user, ORDER_ROLES);
  const money = (cents: number) => formatMoney(cents, locale);
  const details = (href: string) => (
    <a href={href} className="text-gold-deep inline-flex items-center gap-1 text-sm font-medium hover:underline">
      {t.orders.details}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );

  const orderCards = (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {orders.map((o: Order) => {
        const Icon = MODE_ICONS[o.mode ?? 'pickup'] ?? ShoppingBag;
        const status = (o.status ?? 'pending') as OrderStatus;
        const pay = (o.payment?.status ?? 'none') as PaymentStatus;
        return (
          <article key={o.id} className="gg-card space-y-4 p-4" data-order={o.number}>
            <Head
              icon={<Icon />}
              name={o.contact?.name ?? ''}
              meta={`${o.number} · ${MODE_LABELS[o.mode ?? 'pickup'][locale]}`}
              when={slotLabel(o.slot ?? {}, locale, 'short')}
              amount={money(o.totals?.totalCents ?? 0)}
              paid={{ label: PAYMENT_STATUS_LABELS[pay][locale], ok: pay === 'paid' }}
            />
            <div className="flex items-center justify-between gap-2">
              <Pill tone={status}>{ORDER_STATUS_LABELS[status][locale]}</Pill>
              {details(`/admin/collections/orders/${o.id}`)}
            </div>
            {acts && (
              <StaffDecisions
                action={transitionOrder}
                target={{ order: o.id }}
                decisions={decisionsFor(o, s, [], [], money)}
                text={s.decide}
              />
            )}
          </article>
        );
      })}
    </div>
  );

  const tableCards = (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {reservations.map((r) => {
        const preorder = typeof r.preorder === 'object' && r.preorder ? r.preorder : null;
        const status = (r.status ?? 'pending') as ReservationStatus;
        return (
          <article key={r.id} className="gg-card space-y-4 p-4" data-reservation={r.number}>
            <Head
              icon={<Users />}
              name={r.contact?.name ?? ''}
              meta={`${r.number} · ${r.guests} ${t.orders.guests}`}
              when={slotLabel(r.slot ?? {}, locale, 'short')}
              amount={preorder ? money(preorder.totals?.totalCents ?? 0) : undefined}
            />
            <div className="flex items-center justify-between gap-2">
              <Pill tone={status}>{RESERVATION_STATUS_LABELS[status][locale]}</Pill>
              {details(`/admin/collections/reservations/${r.id}`)}
            </div>
            {acts && (
              <StaffDecisions
                kind="reservation"
                action={decideReservation}
                target={{ reservation: r.id }}
                decisions={reservationDecisions(status, preorder, lang)}
                text={s.decide}
              />
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <StaffPage title={t.orders.title} back={{ href: '/staff', label: t.back }} width="wide">
      <StaffTabs
        label={t.orders.title}
        initial={typeof tab === 'string' ? tab : undefined}
        items={[
          {
            key: 'orders',
            label: t.orders.orders,
            count: orders.length,
            content: orders.length ? orderCards : <Empty icon={<ClipboardList />} text={t.orders.noOrders} />,
          },
          {
            key: 'tables',
            label: t.orders.reservations,
            count: reservations.length,
            content: reservations.length ? (
              tableCards
            ) : (
              <Empty icon={<CalendarDays />} text={t.orders.noReservations} />
            ),
          },
        ]}
      />
    </StaffPage>
  );
}
