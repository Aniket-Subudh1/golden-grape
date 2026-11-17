'use client';

import { History, PackageCheck, RotateCcw, ShoppingBag, SlidersHorizontal, Store, Tally5, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Empty } from './tabs';

export type MovementRow = { id: string; type: string; qty: number; title: string; meta: string; day: string };

const ICONS: Record<string, typeof History> = {
  sale: ShoppingBag,
  pos_import: Store,
  receipt: PackageCheck,
  count: Tally5,
  adjustment: SlidersHorizontal,
  return: Undo2,
  cancel: RotateCcw,
};

/**
 * A size's last movements as a timeline (owner request, 17 Nov): grouped by day, an icon per kind, green in and red
 * out, and All / In / Out to narrow it down. The rows come labelled from the server.
 */
export function MovementList({
  rows,
  t,
}: {
  rows: MovementRow[];
  t: { all: string; in: string; out_: string; none: string; more: string };
}) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [limit, setLimit] = useState(15);
  const matching = rows.filter((r) => filter === 'all' || (filter === 'in' ? r.qty > 0 : r.qty < 0));
  // The latest 15 first: a phone screen stays short; "Show more" adds 15 at a time.
  const shown = matching.slice(0, limit);
  const days = [...new Set(shown.map((r) => r.day))];
  const count = {
    all: rows.length,
    in: rows.filter((r) => r.qty > 0).length,
    out: rows.filter((r) => r.qty < 0).length,
  };
  return (
    <div className="space-y-3">
      <div className="border-border inline-flex rounded-xl border bg-white p-1" role="tablist">
        {(['all', 'in', 'out'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => (setFilter(f), setLimit(15))}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition',
              filter === f ? 'bg-ink text-white' : 'text-ink/65 hover:text-ink',
            )}
          >
            {f === 'all' ? t.all : f === 'in' ? t.in : t.out_}
            <span
              className={cn('rounded-full px-1.5 text-xs tabular-nums', filter === f ? 'bg-white/20' : 'bg-[#e7ecf3]')}
            >
              {count[f]}
            </span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty icon={<History />} text={t.none} />
      ) : (
        days.map((day) => (
          <section key={day} className="space-y-1.5">
            <h3 className="text-ink/50 px-1 text-xs font-semibold">{day}</h3>
            <ul className="divide-border gg-card divide-y">
              {shown
                .filter((r) => r.day === day)
                .map((r) => {
                  const Icon = ICONS[r.type] ?? History;
                  const up = r.qty > 0;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                          up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="text-ink/55 block truncate text-xs">{r.meta}</span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums',
                          up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                        )}
                      >
                        {up ? `+${r.qty}` : r.qty}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
      {matching.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 15)}
          className="border-border text-ink/75 hover:border-ink w-full rounded-xl border bg-white py-2.5 text-sm font-medium transition"
        >
          {t.more} ({matching.length - shown.length})
        </button>
      )}
    </div>
  );
}
