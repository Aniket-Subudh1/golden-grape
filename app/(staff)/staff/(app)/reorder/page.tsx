import { CircleAlert, PackageCheck, Plus, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DraftButton } from '@/components/staff/draft-button';
import { StaffPage } from '@/components/staff/page';
import { Empty, StaffTabs } from '@/components/staff/tabs';
import { Button } from '@/components/ui/button';
import { hasRole } from '@/lib/access';
import { interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { bySupplier, type ReorderRow, reorderList } from '@/modules/purchasing/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'À recommander' };

/**
 * Low stock with what to buy (M3.1 T4), in two tabs: by supplier (managers draft the order in one tap) and the items
 * without a supplier price yet (what to set up in the back office). The home tile's screen.
 */
export default async function ReorderPage({ searchParams }: PageProps<'/staff/reorder'>) {
  const { user, locale, t } = await requireStaff('reorder');
  const { tab } = await searchParams;
  const groups = bySupplier(await reorderList(await getPayloadClient(), locale));
  const manager = hasRole(user, ['manager']);
  const r = t.reorder;
  const suppliers = groups.filter((g) => g.id);
  const orphans = groups.find((g) => !g.id)?.rows ?? [];

  const row = (x: ReorderRow) => {
    const pct = x.threshold > 0 ? Math.min(100, Math.round((x.onHand / x.threshold) * 100)) : 0;
    return (
      <li key={x.variant} className="flex items-center gap-4 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{x.name}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e7ecf3]">
              <span
                className={`block h-full rounded-full ${x.onHand === 0 ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </span>
            <span className="text-ink/55 text-xs">
              {interpolate(r.stock, { onHand: x.onHand, level: x.threshold })}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="text-ink/50 block text-[11px] font-semibold tracking-[0.06em] uppercase">{r.suggested}</span>
          <strong className="tabular-nums">
            {x.offer?.unit ? `${x.suggested} × ${x.offer.unit.label}` : `${x.suggested} ${r.units}`}
          </strong>
          {x.offer && <span className="text-ink/55 block text-xs">{formatMoney(x.offer.costCents, locale)}</span>}
        </span>
      </li>
    );
  };

  const bySupplierTab =
    suppliers.length === 0 ? (
      <Empty icon={<PackageCheck />} text={r.none} />
    ) : (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {suppliers.map((g) => {
          const total = g.rows.reduce((sum, x) => sum + (x.offer ? x.offer.costCents * x.suggested : 0), 0);
          return (
            <section key={g.id} className="gg-card overflow-hidden">
              <header className="border-border flex items-center gap-3 border-b px-4 py-3">
                <span className="bg-champagne text-gold-deep grid h-10 w-10 shrink-0 place-items-center rounded-[10px]">
                  <Truck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <h2 className="truncate text-base">{g.name}</h2>
                  <span className="text-ink/55 text-xs">
                    {interpolate(r.products, { n: g.rows.length })} ·{' '}
                    {interpolate(r.estimate, { amount: formatMoney(total, locale) })}
                  </span>
                </span>
                {manager && g.id && (
                  <DraftButton
                    supplier={g.id}
                    lines={g.rows.map((x) => ({
                      variant: x.variant,
                      unit: x.offer?.unit?.id ?? null,
                      unitQty: x.suggested,
                    }))}
                    t={r}
                  />
                )}
              </header>
              <ul className="divide-border divide-y">{g.rows.map(row)}</ul>
            </section>
          );
        })}
      </div>
    );

  const withoutTab =
    orphans.length === 0 ? (
      <Empty icon={<PackageCheck />} text={r.none} />
    ) : (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset sm:flex-row sm:items-center">
          <CircleAlert className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1">{r.noSupplierHint}</span>
          {manager && (
            <Button asChild size="sm" variant="outline" className="border-amber-300 bg-white">
              <Link href="/admin/collections/supplierProducts/create">
                <Plus className="h-4 w-4" />
                {r.addPrice}
              </Link>
            </Button>
          )}
        </div>
        <ul className="divide-border gg-card divide-y">{orphans.map(row)}</ul>
      </div>
    );

  return (
    <StaffPage title={r.title} subtitle={r.intro} back={{ href: '/staff', label: t.back }} width="wide">
      <StaffTabs
        label={r.title}
        initial={typeof tab === 'string' ? tab : undefined}
        items={[
          {
            key: 'suppliers',
            label: r.withSupplier,
            count: suppliers.reduce((n, g) => n + g.rows.length, 0),
            content: bySupplierTab,
          },
          { key: 'none', label: r.withoutSupplier, count: orphans.length, content: withoutTab },
        ]}
      />
    </StaffPage>
  );
}
