'use client';

import { getTranslation } from '@payloadcms/translations';
import { toast, useTranslation } from '@payloadcms/ui';
import { Check, ShoppingBag, Store, Truck, UtensilsCrossed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DefaultCellComponentProps } from 'payload';
import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import { isBeforeSlot, slotLabel, today } from '@/lib/time';
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

type Lang = 'fr' | 'en' | 'de' | 'pt';
const langOf = (language: string): Lang => (['fr', 'en', 'de', 'pt'].includes(language) ? (language as Lang) : 'fr');
const LATE = { fr: 'En retard', en: 'Overdue', de: 'Überfällig', pt: 'Em atraso' };
/** Still waiting for staff: an order not handed over yet, a reservation not closed yet. */
const OPEN = new Set(['pending', 'awaiting_payment', 'confirmed', 'ready', 'out_for_delivery', 'accepted']);

/** The option label of a select field, in the admin's language. */
function optionLabel(field: unknown, value: string, i18n: Parameters<typeof getTranslation>[1]) {
  const options = field && typeof field === 'object' && 'options' in field && Array.isArray(field.options) ? (field.options as { value: string; label: unknown }[]) : [];
  const option = options.find((o) => typeof o === 'object' && o.value === value);
  return option ? String(getTranslation(option.label as never, i18n)) : value;
}

/** The slot as "jeu. 12 nov. · 12:30"; today's slots stand out, and an open one whose time has passed says so (GG-08). */
export function SlotCell({ cellData, rowData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const s = cellData as Group;
  if (!s?.date) return <span className="gg-muted">—</span>;
  const row = rowData as { status?: string; slotAt?: string } | undefined;
  const late = Boolean(row?.slotAt) && OPEN.has(row?.status ?? '') && !isBeforeSlot(row?.slotAt);
  const isToday = s.date === today();
  return (
    <span className="gg-cell-stack">
      <span className={isToday ? 'gg-slot gg-slot--today' : 'gg-slot'}>{slotLabel({ date: String(s.date), from: s.from as string }, i18n.language, 'short')}</span>
      {late && <small className="gg-late">{LATE[langOf(i18n.language)]}</small>}
    </span>
  );
}

const MODE_ICONS: Record<string, typeof Truck> = { pickup: ShoppingBag, delivery: Truck, table: UtensilsCrossed, instore: Store };

/** Pickup, delivery or table at a glance (GG-08): an icon beside the type's name. */
export function ModeCell({ cellData, field }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  if (typeof cellData !== 'string') return null;
  const Icon = MODE_ICONS[cellData] ?? ShoppingBag;
  return (
    <span className={`gg-mode gg-mode--${cellData}`}>
      <Icon aria-hidden />
      {optionLabel(field, cellData, i18n)}
    </span>
  );
}

type Labels = Record<string, Record<Lang, string>>;

/** The payment in one cell (GG-07/08): its state as a coloured badge, its method underneath. */
export function PaymentCell({ cellData, tones, states, methods }: DefaultCellComponentProps & { tones: Record<string, string>; states: Labels; methods: Labels }) {
  const { i18n } = useTranslation();
  const p = cellData as Group;
  if (!p?.status || p.status === 'none') return <span className="gg-muted">—</span>;
  const lang = langOf(i18n.language);
  const status = String(p.status);
  return (
    <span className="gg-cell-stack">
      <span className={`gg-badge gg-badge--${tones[status] ?? 'neutral'}`}>{states[status]?.[lang] ?? status}</span>
      {typeof p.method === 'string' && <small>{methods[p.method]?.[lang] ?? p.method}</small>}
    </span>
  );
}

/** A delivery address on one line; empty for pickups. */
export function AddressCell({ cellData }: DefaultCellComponentProps) {
  const a = cellData as Group;
  if (!a?.line1) return <span className="gg-muted">—</span>;
  return (
    <span className="gg-cell-stack">
      {String(a.line1)}
      <small>{[a.postalCode, a.city].filter(Boolean).join(' ')}</small>
    </span>
  );
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
