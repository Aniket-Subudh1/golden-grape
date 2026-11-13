'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DefaultCellComponentProps } from 'payload';
import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import { slotLabel, today } from '@/lib/time';
import { decideReservation } from '../actions';
import { salesText } from './text';

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

/**
 * "Client arrivé" / "Client absent" on an accepted reservation whose day has come (QA 12 Nov, GG-05), straight from
 * the list during service: one click, a confirmation in place, then the list reloads. A reservation with a pre-order
 * opens its page instead, where staff say what was paid for it (GG-02).
 */
export function AttendanceCell({ rowData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const router = useRouter();
  const [asked, setAsked] = useState<'completed' | 'no_show' | null>(null);
  const [busy, setBusy] = useState(false);
  const row = rowData as { id?: string; status?: string; slot?: { date?: string } | null; preorder?: unknown } | undefined;
  if (!row?.id || row.status !== 'accepted' || !row.slot?.date || row.slot.date > today()) return null;
  const t = salesText(i18n.language);
  const href = `/admin/collections/reservations/${row.id}`;

  async function decide(to: 'completed' | 'no_show') {
    setBusy(true);
    const input = new FormData();
    input.set('reservation', row!.id!);
    input.set('to', to);
    const result = await decideReservation(null, input);
    setBusy(false);
    setAsked(null);
    if (!result.ok) {
      toast.error(t.decide.errors[result.message ?? ''] ?? t.decide.errors[result.error] ?? t.decide.error);
      return;
    }
    toast.success(t.decide.done);
    router.refresh();
  }

  if (asked) {
    return (
      <span className="gg-attend">
        <span>{t.reservations[asked].label} ?</span>
        <button type="button" className={`gg-btn gg-btn--sm ${asked === 'no_show' ? 'gg-btn--danger' : 'gg-btn--primary'}`} disabled={busy} onClick={() => decide(asked)}>
          {t.decide.confirm}
        </button>
        <button type="button" className="gg-btn gg-btn--sm" disabled={busy} onClick={() => setAsked(null)}>
          {t.decide.back}
        </button>
      </span>
    );
  }
  return (
    <span className="gg-attend">
      {row.preorder ? (
        <a className="gg-btn gg-btn--sm gg-btn--primary" href={href}>
          {t.reservations.completed.label}
        </a>
      ) : (
        <button type="button" className="gg-btn gg-btn--sm gg-btn--primary" onClick={() => setAsked('completed')}>
          {t.reservations.completed.label}
        </button>
      )}
      <button type="button" className="gg-btn gg-btn--sm gg-btn--quiet-danger" onClick={() => setAsked('no_show')}>
        {t.reservations.no_show.label}
      </button>
    </span>
  );
}
