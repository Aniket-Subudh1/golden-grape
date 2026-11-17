import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdjustForm } from '@/components/staff/adjust-form';
import { MovementList } from '@/components/staff/movement-list';
import { StaffPage } from '@/components/staff/page';
import { boxesHint } from '@/components/staff/product-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { localStamp, today } from '@/lib/time';
import { staffItems } from '@/modules/catalogue/service';
import { ADJUST_REASONS, REASON_LABELS, TYPE_LABELS } from '@/modules/inventory/labels';
import { movementsOf, onHand } from '@/modules/inventory/service';
import { getSettingsPrivate } from '@/modules/settings/service';
import { canOpen, requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Stock' };

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f3f5f9] px-3 py-2.5">
      <dt className="text-ink/55 text-[10px] leading-tight font-semibold tracking-[0.04em] uppercase sm:text-[11px]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-tight font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * One size's stock (M3.1 T3, reworked 17 Nov): what is on the shelf and whether it is low, a correction (add or remove,
 * how many, why, the stock it leaves), and the last 50 movements as a timeline.
 */
export default async function StockPage({ params }: PageProps<'/staff/stock/[variant]'>) {
  const { variant } = await params;
  const { user, locale, t, dict } = await requireStaff('stock', `/staff/stock/${variant}`);
  const payload = await getPayloadClient();
  const [[item], stock, movements, levels, settings, sell] = await Promise.all([
    staffItems(payload, [variant], locale),
    onHand(payload, [variant]),
    movementsOf(payload, variant, 50),
    payload.find({
      collection: 'stockLevels',
      where: { variant: { equals: variant } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    }),
    getSettingsPrivate(),
    canOpen(user, 'sale'),
  ]);
  if (!item) notFound();
  const s = t.stockPage;
  const label = (labels: Record<string, Record<string, string>>, key: string | null) =>
    key ? (labels[key]?.[locale] ?? key) : '';
  const qty = stock[variant] ?? 0;
  const level = levels.docs[0]?.lowStockThreshold ?? settings.alerts?.defaultLowStock ?? 3;
  const status = !item.trackStock ? 'off' : qty <= 0 ? 'out' : qty <= level ? 'low' : 'ok';
  const hint = boxesHint(qty, item.units, t.card.boxesHint);

  const day = today();
  const [y, m, d] = day.split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  const dayName = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Luxembourg',
  });
  const rows = movements.map((m) => {
    const stamp = localStamp(new Date(m.at));
    const d = stamp.slice(0, 10);
    return {
      id: m.id,
      type: m.type,
      qty: m.qty,
      title: [label(TYPE_LABELS, m.type), m.ref].filter(Boolean).join(' · '),
      meta: [stamp.slice(11, 16), m.user, m.reason && label(REASON_LABELS, m.reason), m.box]
        .filter(Boolean)
        .join(' · '),
      day: d === day ? s.today : d === yesterday ? s.yesterday : dayName.format(new Date(m.at)),
    };
  });
  const last = movements[0] ? localStamp(new Date(movements[0].at)) : null;

  return (
    <StaffPage
      title={item.name}
      subtitle={[item.label, item.sku].filter(Boolean).join(' · ')}
      back={{ href: '/staff/scan', label: t.back }}
      width="wide"
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-8"
    >
      <div className="space-y-4">
        <section className="gg-card overflow-hidden">
          <div className="flex gap-4 p-4 md:p-5">
            <div className="bg-champagne relative h-28 w-24 shrink-0 overflow-hidden rounded-xl">
              {item.image && <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                  status === 'ok' && 'bg-emerald-50 text-emerald-800 ring-emerald-200',
                  status === 'low' && 'bg-amber-50 text-amber-800 ring-amber-200',
                  status === 'out' && 'bg-red-50 text-red-700 ring-red-200',
                  status === 'off' && 'text-ink/65 ring-border bg-[#e7ecf3]',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {status === 'ok' ? s.inStock : status === 'low' ? s.low : status === 'out' ? s.out : s.notTracked}
              </span>
              <p className="mt-2 truncate text-base font-semibold md:hidden">{item.name}</p>
              {item.trackStock && (
                <p className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-4xl font-semibold tracking-[-0.02em] tabular-nums',
                      status === 'out' && 'text-red-700',
                    )}
                    data-testid="on-hand"
                  >
                    {qty}
                  </span>
                  <span className="text-ink/55 text-sm">{s.bottles}</span>
                </p>
              )}
              {hint && <p className="text-ink/60 text-sm">{hint}</p>}
            </div>
          </div>
          <dl className="border-border grid grid-cols-3 gap-2 border-t p-3 md:px-5">
            <Figure label={s.level}>{item.trackStock ? level : '—'}</Figure>
            <Figure label={s.price}>{formatMoney(item.priceCents, locale)}</Figure>
            <Figure label={s.lastMove}>
              {last ? `${last.slice(8, 10)}/${last.slice(5, 7)} ${last.slice(11, 16)}` : s.never}
            </Figure>
          </dl>
          {(item.units.length > 0 || sell) && (
            <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3 md:px-5">
              {item.units.map((u) => (
                <span key={u.id} className="border-border rounded-full border bg-white px-3 py-1 text-xs">
                  {u.label} · <strong className="tabular-nums">{formatMoney(u.priceCents, locale)}</strong>
                </span>
              ))}
              {sell && (
                <Button asChild size="sm" className="ml-auto">
                  <Link href={`/staff/sale?add=${variant}`}>
                    <ShoppingBag className="h-4 w-4" />
                    {s.sell}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>
        {item.trackStock && (
          <AdjustForm
            variant={variant}
            onHand={qty}
            boxes={[...new Set(item.units.map((u) => u.factor))].filter((f) => f > 1)}
            reasons={ADJUST_REASONS.map((r) => ({ value: r, label: label(REASON_LABELS, r) }))}
            t={t.adjust}
            messages={{
              error: dict.form.error,
              OUT_OF_STOCK: t.adjust.belowZero,
              fields: { ...dict.form.fields, zero: t.adjust.zero, min3: t.adjust.min3 },
            }}
          />
        )}
      </div>
      <section>
        <h2 className="eyebrow text-ink/55 mb-2">{s.movements}</h2>
        <MovementList rows={rows} t={{ all: s.all, in: s.in, out_: s.out_, none: s.noMovements, more: s.more }} />
      </section>
    </StaffPage>
  );
}
