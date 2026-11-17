import type { Metadata } from 'next';
import { DraftButton } from '@/components/staff/draft-button';
import { TopBar } from '@/components/staff/top-bar';
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
    <>
      <TopBar title={t.reorder.title} back={{ href: '/staff', label: t.back }} />
      <main className="space-y-4 p-4">
        <p className="text-sm text-ink/60">{t.reorder.intro}</p>
        {groups.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink/55">{t.reorder.none}</p>}
        {groups.map((g) => (
          <section key={g.id ?? 'none'} className="rounded-xl border border-border bg-white/70">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="font-serif text-xl">{g.name ?? t.reorder.noSupplier}</h2>
              {manager && g.id && (
                <DraftButton supplier={g.id} lines={g.rows.map((r) => ({ variant: r.variant, unit: r.offer?.unit?.id ?? null, unitQty: r.suggested }))} t={t.reorder} />
              )}
            </header>
            <ul className="divide-y divide-border">
              {g.rows.map((r) => (
                <li key={r.variant} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block">{r.name}</span>
                    <span className="text-xs text-ink/55">{interpolate(t.reorder.stock, { onHand: r.onHand, level: r.threshold })}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <strong className="tabular-nums">
                      {r.offer?.unit ? `${r.suggested} × ${r.offer.unit.label}` : `${r.suggested} ${t.reorder.units}`}
                    </strong>
                    {r.offer && <span className="block text-xs text-ink/55">{formatMoney(r.offer.costCents, locale)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
