'use client';

import { getTranslation } from '@payloadcms/translations';
import { useTranslation } from '@payloadcms/ui';
import { Check, ShoppingBag, Store, Truck, UtensilsCrossed } from 'lucide-react';
import type { DefaultCellComponentProps } from 'payload';
import { formatMoney } from '@/lib/money';
import { isBeforeSlot, slotLabel, today } from '@/lib/time';

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
