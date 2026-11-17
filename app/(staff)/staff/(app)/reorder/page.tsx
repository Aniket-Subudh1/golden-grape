import type { Metadata } from 'next';
import { DraftButton } from '@/components/staff/draft-button';
import { StaffPage } from '@/components/staff/page';
import { hasRole } from '@/lib/access';
import { interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { bySupplier, reorderList } from '@/modules/purchasing/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'À recommander' };

/** Low stock with what to buy, by supplier (M3.1 T4): the home tile's screen. Managers can draft the order from it. */
export default async function ReorderPage() {
  const { user, locale, t } = await requireStaff('reorder');
  const groups = bySupplier(await reorderList(await getPayloadClient(), locale));
  const manager = hasRole(user, ['manager']);
  return (
    <StaffPage
      title={t.reorder.title}
      back={{ href: '/staff', label: t.back }}
      width="wide"
      className="grid items-start gap-4 lg:grid-cols-2"
    >
      <p className="text-ink/60 col-span-full text-sm">{t.reorder.intro}</p>
      {groups.length === 0 && (
        <p className="border-border text-ink/55 col-span-full rounded-xl border border-dashed p-6 text-center text-sm">
          {t.reorder.none}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.id ?? 'none'} className="gg-card">
          <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-serif text-xl">{g.name ?? t.reorder.noSupplier}</h2>
            {manager && g.id && (
              <DraftButton
                supplier={g.id}
                lines={g.rows.map((r) => ({
                  variant: r.variant,
                  unit: r.offer?.unit?.id ?? null,
                  unitQty: r.suggested,
                }))}
                t={t.reorder}
              />
            )}
          </header>
          <ul className="divide-border divide-y">
            {g.rows.map((r) => (
              <li key={r.variant} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block">{r.name}</span>
                  <span className="text-ink/55 text-xs">
                    {interpolate(t.reorder.stock, { onHand: r.onHand, level: r.threshold })}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <strong className="tabular-nums">
                    {r.offer?.unit ? `${r.suggested} × ${r.offer.unit.label}` : `${r.suggested} ${t.reorder.units}`}
                  </strong>
                  {r.offer && (
                    <span className="text-ink/55 block text-xs">{formatMoney(r.offer.costCents, locale)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </StaffPage>
  );
}
