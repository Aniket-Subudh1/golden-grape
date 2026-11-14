import type { Where } from 'payload';
import { entriesOf, l, type Label } from '@/lib/admin';
import { type OrderStatus, SOLD, UNPAID } from '../order-states';

// The Orders list's stage tabs (GG-001) and the shortcuts into it from the dashboard and the bell, with the one rule
// that says which of them a list URL is (QA 14 Nov, GG-22). A tab is lit only when the URL's conditions are exactly
// its own (statuses and mode), so a lit tab always says what is listed; a shortcut that is not a stage (refunds to
// send, money still to collect, the orders sold over a range…) is named in a chip instead; any other filter is said
// as "Filtre actif". Each tab is a plain Payload list query, so search, columns and paging keep working.

type Condition = { field: string; op: 'in' | 'equals' | 'not_equals'; values: readonly string[] };
type Range = { from: string; to: string };

/**
 * `skipTable`: a table's pre-order waits for its reservation (counted under Table reservations), not for this tab
 * (GG-020). `onlyTable`: those pre-orders, in a tab of their own so they stay visible (APPLUX audit 10 Nov, §2).
 */
export type OrderTab = { key: string; label: Label; statuses?: OrderStatus[]; skipTable?: boolean; onlyTable?: boolean; sort: string; empty: Label };

export const ORDER_TABS: OrderTab[] = [
  {
    key: 'todo',
    label: l('À traiter', 'To do', 'Zu erledigen', 'A tratar'),
    statuses: ['pending', 'awaiting_payment'],
    skipTable: true,
    sort: 'slotAt',
    empty: l('Rien à confirmer pour le moment.', 'Nothing to confirm right now.', 'Im Moment nichts zu bestätigen.', 'Nada para confirmar de momento.'),
  },
  {
    key: 'tables',
    label: l('Pré-commandes de table', 'Table pre-orders', 'Tisch-Vorbestellungen', 'Pré-encomendas de mesa'),
    statuses: ['pending'],
    onlyTable: true,
    sort: 'slotAt',
    empty: l(
      'Aucune pré-commande en attente. Une pré-commande est acceptée ou refusée avec sa réservation de table.',
      'No pre-order waiting. A pre-order is accepted or declined with its table reservation.',
      'Keine Vorbestellung offen. Eine Vorbestellung wird mit ihrer Tischreservierung angenommen oder abgelehnt.',
      'Nenhuma pré-encomenda à espera. Uma pré-encomenda é aceite ou recusada com a sua reserva de mesa.',
    ),
  },
  {
    key: 'preparing',
    label: l('À préparer', 'Preparing', 'In Vorbereitung', 'Em preparação'),
    statuses: ['confirmed'],
    sort: 'slotAt',
    empty: l('Aucune commande à préparer.', 'No orders to prepare.', 'Keine Bestellungen vorzubereiten.', 'Sem encomendas para preparar.'),
  },
  {
    key: 'ready',
    label: l('Prêtes / en livraison', 'Ready / out for delivery', 'Bereit / in Zustellung', 'Prontas / em entrega'),
    statuses: ['ready', 'out_for_delivery'],
    sort: 'slotAt',
    empty: l('Aucune commande en attente de remise.', 'No orders waiting to be handed over.', 'Keine Bestellungen warten auf Übergabe.', 'Sem encomendas à espera de entrega.'),
  },
  {
    key: 'completed',
    label: l('Terminées', 'Completed', 'Abgeschlossen', 'Concluídas'),
    statuses: ['completed'],
    sort: '-slotAt',
    empty: l('Aucune commande terminée.', 'No completed orders.', 'Keine abgeschlossenen Bestellungen.', 'Sem encomendas concluídas.'),
  },
  {
    key: 'cancelled',
    label: l('Annulées', 'Cancelled', 'Storniert', 'Canceladas'),
    statuses: ['cancelled'],
    sort: '-slotAt',
    empty: l('Aucune commande annulée.', 'No cancelled orders.', 'Keine stornierten Bestellungen.', 'Sem encomendas canceladas.'),
  },
  {
    key: 'refunded',
    label: l('Remboursées', 'Refunded', 'Erstattet', 'Reembolsadas'),
    statuses: ['refunded'],
    sort: '-slotAt',
    empty: l('Aucune commande remboursée.', 'No refunded orders.', 'Keine erstatteten Bestellungen.', 'Sem encomendas reembolsadas.'),
  },
  {
    key: 'all',
    label: l('Toutes', 'All', 'Alle', 'Todas'),
    sort: '-createdAt',
    empty: l('Aucune commande pour l’instant.', 'No orders yet.', 'Noch keine Bestellungen.', 'Ainda sem encomendas.'),
  },
];

const NOT_TABLE: Condition = { field: 'mode', op: 'not_equals', values: ['table'] };
const conditionsOfTab = (tab: OrderTab): Condition[] => [
  ...(tab.statuses ? [{ field: 'status', op: 'in' as const, values: tab.statuses }] : []),
  ...(tab.skipTable ? [NOT_TABLE] : []),
  ...(tab.onlyTable ? [{ field: 'mode', op: 'equals' as const, values: ['table'] }] : []),
];

/**
 * The shortcuts into the list that are not a stage, named by the dashboard tile or bell line that opens them
 * (`components/admin/text.ts`). "Sold" takes the range of slot days its figure covers.
 */
export const ORDER_VIEWS = {
  // The two halves of "À traiter", as the bell counts them.
  toConfirm: { conditions: [{ field: 'status', op: 'in', values: ['pending'] }, NOT_TABLE], sort: 'slotAt' },
  awaitingPayment: { conditions: [{ field: 'status', op: 'in', values: ['awaiting_payment'] }, NOT_TABLE], sort: 'slotAt' },
  refunds: { conditions: [{ field: 'payment.status', op: 'equals', values: ['refund_pending'] }], sort: '-updatedAt' },
  due: { conditions: [{ field: 'status', op: 'in', values: SOLD }, { field: 'payment.status', op: 'in', values: UNPAID }], sort: 'slotAt' },
  sold: { conditions: [{ field: 'status', op: 'in', values: SOLD }], sort: '-slotAt' },
} satisfies Record<string, { conditions: Condition[]; sort: string }>;
export type OrderView = keyof typeof ORDER_VIEWS;

/** A tab's conditions as a Payload `where` (its counts, the sidebar and the bell figures in alerts.ts). */
export const orderTabWhere = (tab: OrderTab): Where[] => conditionsOfTab(tab).map(({ field, op, values }) => ({ [field]: { [op]: op === 'in' ? values : values[0] } }));

/** The list URL's query for these conditions, the day picker's day, a range of slot days, the search and the sort. */
function queryOf(conditions: Condition[], keep: { search?: string; day?: string; range?: Range; sort?: string }) {
  const params = new URLSearchParams();
  let i = 0;
  for (const { field, op, values } of conditions) {
    if (op === 'in') values.forEach((value, n) => params.set(`where[and][${i}][${field}][in][${n}]`, value));
    else params.set(`where[and][${i}][${field}][${op}]`, values[0]);
    i++;
  }
  if (keep.day) params.set(`where[and][${i++}][slot.date][equals]`, keep.day);
  if (keep.range) {
    params.set(`where[and][${i++}][slot.date][greater_than_equal]`, keep.range.from);
    params.set(`where[and][${i++}][slot.date][less_than_equal]`, keep.range.to);
  }
  if (keep.search) params.set('search', keep.search);
  if (keep.sort) params.set('sort', keep.sort);
  return `?${params.toString()}`;
}

/** The list URL's query for a tab, keeping the search and the slot day. The sidebar opens the first tab. */
export const orderTabQuery = (tab: OrderTab, keep: { search?: string; day?: string } = {}) => queryOf(conditionsOfTab(tab), { ...keep, sort: tab.sort });

/** The Orders list opened on a shortcut (dashboard tiles, the bell). */
export const orderViewUrl = (view: OrderView, range?: Range) => `/admin/collections/orders${queryOf(ORDER_VIEWS[view].conditions, { range, sort: ORDER_VIEWS[view].sort })}`;

// `where[and][0][status][in][1]`, `where[or][0][and][2][payment.status][equals]`, `where[status][in]` (a comma list).
const KEY = /^where((?:\[(?:and|or)\]\[\d+\])*)\[([^\]]+)\]\[(in|equals|not_equals|greater_than_equal|less_than_equal)\](?:\[\d+\])?$/;

/** Conditions in one comparable form: `equals x` is `in [x]`, values sorted, and their order in the URL ignored. */
const signatureOf = (conditions: Condition[]) =>
  conditions
    .map(({ field, op, values }) => `${field}|${op === 'equals' ? 'in' : op}|${[...values].sort().join(',')}`)
    .sort()
    .join(';');

const TAB_SIGNATURES = ORDER_TABS.map((t) => signatureOf(conditionsOfTab(t)));
const VIEW_SIGNATURES = Object.entries(ORDER_VIEWS).map(([key, v]) => [key as OrderView, signatureOf(v.conditions)] as const);

export type OrderQueryMatch = { tab?: OrderTab; view?: OrderView; filtered: boolean; day: string; range?: Range };

/**
 * Which tab or shortcut a list URL is. A tab only when its conditions are exactly the tab's (the day picker's day
 * and the search aside); else a shortcut (the sold one may carry a range of slot days); else, with any condition,
 * `filtered`. Conditions in several OR groups, or one field twice in different groups, are never a tab.
 */
export function matchOrderQuery(searchParams: Record<string, unknown>): OrderQueryMatch {
  const conditions = new Map<string, { group: string; field: string; op: Condition['op']; values: string[] }>();
  let day = '';
  let from = '';
  let to = '';
  let unknown = false;
  for (const [key, value] of entriesOf(searchParams)) {
    if (!key.startsWith('where')) continue;
    const m = KEY.exec(key);
    if (!m || /\[or\]\[[1-9]\d*\]/.test(m[1])) {
      unknown = true;
      continue;
    }
    const [, group, field, op] = m;
    const values = value.split(',').filter(Boolean);
    if (field === 'slot.date') {
      if (op === 'equals') day = values[0] ?? '';
      else if (op === 'greater_than_equal') from = values[0] ?? '';
      else if (op === 'less_than_equal') to = values[0] ?? '';
      else unknown = true;
      continue;
    }
    if (op !== 'in' && op !== 'equals' && op !== 'not_equals') {
      unknown = true;
      continue;
    }
    // The values of one `in` share their group; the same field again in another group is a second condition.
    const id = `${field}|${op}`;
    const seen = conditions.get(id);
    if (seen && seen.group !== group) unknown = true;
    if (seen) seen.values.push(...values);
    else conditions.set(id, { group, field, op, values });
  }
  const range = from || to ? { from, to } : undefined;
  const none = { tab: undefined, view: undefined, filtered: true, day, range };
  if (unknown || (range && !(from && to))) return none;
  const signature = signatureOf([...conditions.values()]);
  const tab = range ? undefined : ORDER_TABS[TAB_SIGNATURES.indexOf(signature)];
  if (tab) return { ...none, tab, filtered: false };
  const view = VIEW_SIGNATURES.find(([key, s]) => s === signature && (!range || key === 'sold'))?.[0];
  if (view) return { ...none, view, filtered: false };
  return none;
}
