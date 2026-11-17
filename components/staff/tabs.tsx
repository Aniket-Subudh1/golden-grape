'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';

export type TabItem = { key: string; label: string; count?: number; content: ReactNode };

/**
 * Two or three views of one screen (orders | tables, counts in progress | posted, reorder by supplier | without): a
 * segmented control above the panel. The choice is kept in `?tab=` so a refresh, or a move that reloads the page,
 * stays on it.
 */
export function StaffTabs({ items, initial, label }: { items: TabItem[]; initial?: string; label: string }) {
  const [active, setActive] = useState(items.some((i) => i.key === initial) ? initial! : items[0].key);
  const pick = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState(window.history.state, '', url);
  };
  const current = items.find((i) => i.key === active) ?? items[0];
  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        className="border-border inline-flex w-full rounded-xl border bg-white p-1 shadow-[0_1px_2px_rgb(26_28_32/0.04)] md:w-auto"
      >
        {items.map((item) => {
          const on = item.key === current.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`tab-${item.key}`}
              aria-selected={on}
              aria-controls={`panel-${item.key}`}
              onClick={() => pick(item.key)}
              className={cn(
                'flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition md:flex-none',
                on ? 'bg-ink text-white shadow-sm' : 'text-ink/65 hover:text-ink',
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                    on ? 'bg-white/20' : 'bg-[#e7ecf3]',
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`}>
        {current.content}
      </div>
    </div>
  );
}

/** The empty state of a list: an icon, one line, and an optional action. */
export function Empty({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white/50 px-6 py-10 text-center">
      <span className="text-ink/45 grid h-12 w-12 place-items-center rounded-full bg-[#e7ecf3] [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </span>
      <p className="text-ink/60 max-w-xs text-sm">{text}</p>
      {action}
    </div>
  );
}
