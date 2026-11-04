'use client';

import { useTranslation } from '@payloadcms/ui';
import { Check } from 'lucide-react';
import type { DefaultCellComponentProps } from 'payload';
import { formatMoney } from '@/lib/money';
import { slotLabel, today } from '@/lib/time';

// List cells for orders, reservations and event bookings: the group fields (contact, slot, totals) as one short line.

type Group = Record<string, unknown> | null | undefined;

export function ContactCell({ cellData }: DefaultCellComponentProps) {
  const c = cellData as Group;
  if (!c?.name) return <span className="gg-muted">—</span>;
  return (
    <span className="gg-cell-stack">
      <b>{String(c.name)}</b>
      {typeof c.phone === 'string' && <small>{c.phone}</small>}
    </span>
  );
}

/** The slot as "jeu. 12 nov. · 12:30"; today's slots stand out. */
export function SlotCell({ cellData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const s = cellData as Group;
  if (!s?.date) return <span className="gg-muted">—</span>;
  const isToday = s.date === today();
  return <span className={isToday ? 'gg-slot gg-slot--today' : 'gg-slot'}>{slotLabel({ date: String(s.date), from: s.from as string }, i18n.language, 'short')}</span>;
}

export function TotalCell({ cellData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const t = cellData as Group;
  if (typeof t?.totalCents !== 'number') return <span className="gg-muted">—</span>;
  return <span className="gg-money">{formatMoney(t.totalCents, i18n.language)}</span>;
}

export function PreorderCell({ cellData }: DefaultCellComponentProps) {
  return cellData ? <Check className="gg-cell-check" aria-label="✓" /> : <span className="gg-muted">—</span>;
}
