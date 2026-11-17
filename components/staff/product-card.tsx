import Image from 'next/image';
import type { ReactNode } from 'react';
import { interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { ScanCard } from '@/modules/catalogue/actions';

export type CardTexts = { onHand: string; boxesHint: string; notTracked: string; price: string; units: string };

/** "= 4 × Carton de 6 + 2": the stock read in the biggest box, for whoever stacks the shelves. */
export function boxesHint(onHand: number, units: ScanCard['units'], template: string) {
  const box = units.at(-1);
  if (!box || onHand < box.factor) return null;
  const rest = onHand % box.factor;
  return `${interpolate(template, { n: Math.floor(onHand / box.factor), label: box.label })}${rest ? ` + ${rest}` : ''}`;
}

/** A size as the staff screens show it (M3.1 T3): photo, name, stock in bottles with the box hint, prices, boxes. */
export function ProductCard({ item, locale, t, children }: { item: ScanCard; locale: Locale; t: CardTexts; children?: ReactNode }) {
  const hint = boxesHint(item.onHand, item.units, t.boxesHint);
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white/70">
      <div className="flex gap-4 p-4">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-champagne">
          {item.image && <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl leading-tight">{item.name}</h2>
          <p className="text-xs text-ink/55">{[item.label, item.sku].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 text-sm">
            {item.trackStock ? (
              <>
                <span className="eyebrow mr-2 text-ink/50">{t.onHand}</span>
                <strong className={item.onHand <= 0 ? 'text-red-700' : undefined} data-testid="on-hand">
                  {item.onHand}
                </strong>
                {hint && <span className="ml-1 text-ink/55">{hint}</span>}
              </>
            ) : (
              <span className="text-ink/55">{t.notTracked}</span>
            )}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-sm">
        <dt className="text-ink/60">{item.label ?? t.price}</dt>
        <dd className="text-right tabular-nums">{formatMoney(item.priceCents, locale)}</dd>
        {item.units.map((u) => (
          <div key={u.id} className="contents">
            <dt className="text-ink/60">{u.label}</dt>
            <dd className="text-right tabular-nums">{formatMoney(u.priceCents, locale)}</dd>
          </div>
        ))}
      </dl>
      {children && <div className="flex flex-wrap gap-2 border-t border-border p-3">{children}</div>}
    </article>
  );
}
