import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdjustForm } from '@/components/staff/adjust-form';
import { ProductCard } from '@/components/staff/product-card';
import { StaffPage } from '@/components/staff/page';
import { getPayloadClient } from '@/lib/payload';
import { dayStamp } from '@/lib/time';
import { staffItems } from '@/modules/catalogue/service';
import { ADJUST_REASONS, REASON_LABELS, TYPE_LABELS } from '@/modules/inventory/labels';
import { movementsOf, onHand } from '@/modules/inventory/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Stock' };

/** One size's stock (M3.1 T3): the card, a correction, and the last 50 movements with who and why. */
export default async function StockPage({ params }: PageProps<'/staff/stock/[variant]'>) {
  const { variant } = await params;
  const { locale, t, dict } = await requireStaff('stock', `/staff/stock/${variant}`);
  const payload = await getPayloadClient();
  const [[item], stock, movements] = await Promise.all([
    staffItems(payload, [variant], locale),
    onHand(payload, [variant]),
    movementsOf(payload, variant, 50),
  ]);
  if (!item) notFound();
  const label = (labels: Record<string, Record<string, string>>, key: string | null) =>
    key ? (labels[key]?.[locale] ?? key) : '';
  return (
    <StaffPage
      title={t.stockPage.title}
      back={{ href: '/staff/scan', label: t.back }}
      width="wide"
      className="grid items-start gap-4 lg:grid-cols-2 lg:gap-8"
    >
      <div className="space-y-4">
        <ProductCard item={{ ...item, onHand: stock[variant] ?? 0 }} locale={locale} t={t.card} />
        {item.trackStock && (
          <AdjustForm
            variant={variant}
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
        <h2 className="eyebrow text-ink/60 mb-2">{t.stockPage.movements}</h2>
        {movements.length === 0 ? (
          <p className="text-ink/55 text-sm">{t.stockPage.noMovements}</p>
        ) : (
          <ul className="divide-border gg-card divide-y">
            {movements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>
                    {label(TYPE_LABELS, m.type)}
                    {m.ref && <span className="text-ink/55"> · {m.ref}</span>}
                  </p>
                  <p className="text-ink/55 text-xs">
                    {dayStamp(new Date(m.at))}
                    {m.user && ` · ${m.user}`}
                    {m.reason && ` · ${label(REASON_LABELS, m.reason)}`}
                    {m.box && ` · ${m.box}`}
                  </p>
                </div>
                <span className={`shrink-0 tabular-nums ${m.qty > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {m.qty > 0 ? `+${m.qty}` : m.qty}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StaffPage>
  );
}
