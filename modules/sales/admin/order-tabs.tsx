import Link from 'next/link';
import type { PaginatedDocs, Payload, Where } from 'payload';
import EmptyList from '@/components/admin/empty-list';
import { l, type Label } from '@/lib/admin';
import type { OrderStatus } from '../order-states';
import OrderDay from './order-day';

// The Orders list split by what staff must do (GG-001): one tab per stage, opened on "To do". Each tab is a plain
// Payload list query (`where[status][in]` + sort), so Payload's own search, filters, columns and paging keep
// working; the tabs keep the search and the chosen day, and their counts follow both. "All" finds any order.

/**
 * `skipTable`: a table's pre-order waits for its reservation (counted under Table reservations), not for this tab
 * (GG-020). `onlyTable`: those pre-orders, in a tab of their own so they stay visible (APPLUX audit 10 Nov, §2).
 */
type Tab = { key: string; label: Label; statuses?: OrderStatus[]; skipTable?: boolean; onlyTable?: boolean; sort: string; empty: Label };

export const ORDER_TABS: Tab[] = [
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

/** A tab's conditions as a Payload `where` (its counts here, the sidebar and bell figures in alerts.ts). */
export const orderTabWhere = (tab: Tab): Where[] => [
  ...(tab.statuses ? [{ status: { in: tab.statuses } }] : []),
  ...(tab.skipTable ? [{ mode: { not_equals: 'table' } }] : []),
  ...(tab.onlyTable ? [{ mode: { equals: 'table' } }] : []),
];

/** The list URL's query for a tab, keeping the search and the slot day. The sidebar opens the first tab. */
export function orderTabQuery(tab: Tab, keep: { search?: string; day?: string } = {}) {
  const params = new URLSearchParams();
  let i = 0;
  if (tab.statuses) {
    tab.statuses.forEach((status, n) => params.set(`where[and][${i}][status][in][${n}]`, status));
    i++;
  }
  if (tab.skipTable) params.set(`where[and][${i++}][mode][not_equals]`, 'table');
  if (tab.onlyTable) params.set(`where[and][${i++}][mode][equals]`, 'table');
  if (keep.day) params.set(`where[and][${i}][slot.date][equals]`, keep.day);
  if (keep.search) params.set('search', keep.search);
  params.set('sort', tab.sort);
  return `?${params.toString()}`;
}

// Next hands Payload's list the raw query (`where[and][0][status][in]` as a flat key), in our shape or in the one
// Payload's filter builder writes (`where[or][0][and][0][status][in][0]`): read the values whatever the nesting.
// An already-parsed `where` object is flattened to the same bracket keys first.
const flat = (value: unknown, key: string): [string, unknown][] =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).flatMap(([k, v]) => flat(v, `${key}[${k}]`)) : [[key, value]];
const valuesOf = (searchParams: Record<string, unknown>, test: RegExp) =>
  Object.entries(searchParams)
    .flatMap(([key, value]) => flat(value, key))
    .filter(([key]) => test.test(key))
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
    .flatMap((v) => String(v).split(','))
    .filter(Boolean);

type Props = {
  payload: Payload;
  data?: PaginatedDocs;
  searchParams?: Record<string, unknown>;
  listSearchableFields?: string[];
  i18n?: { language: string };
};

export default async function OrderTabs({ payload, data, searchParams = {}, listSearchableFields = [], i18n }: Props) {
  const lang = (i18n?.language ?? 'fr') as keyof Label;
  const say = (label: Label) => label[lang] ?? label.fr;
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';
  const day = valuesOf(searchParams, /^where\[.*\]\[slot\.date\]\[equals\]$/)[0] ?? '';
  const statuses = valuesOf(searchParams, /^where\[.*\]\[status\]\[(in|equals)\](\[\d+\])?$/).sort().join(',');
  const active = ORDER_TABS.find((t) => (t.statuses ?? []).toSorted().join(',') === statuses);
  // The day picker stays on this tab ("All" when the status filter was set by hand in Payload's filters).
  const current = active ?? ORDER_TABS[ORDER_TABS.length - 1];

  // The counts match what the tab will show: same search (Payload's: `like` on the searchable fields) and day.
  const base: Where[] = [];
  if (day) base.push({ 'slot.date': { equals: day } });
  if (search) base.push({ or: listSearchableFields.map((f) => ({ [f]: { like: search } })) });
  const counts = await Promise.all(
    ORDER_TABS.map((t) =>
      payload.count({ collection: 'orders', where: { and: [...base, ...orderTabWhere(t)] } }).then((r) => r.totalDocs),
    ),
  );

  return (
    <>
      <nav className="gg-tabs" aria-label={say(l('Étapes des commandes', 'Order stages', 'Bestellschritte', 'Etapas das encomendas'))}>
        {ORDER_TABS.map((t, i) => (
          <Link
            key={t.key}
            href={orderTabQuery(t, { search, day })}
            className="gg-tabs__tab"
            data-active={t === active || undefined}
            data-urgent={(i === 0 && counts[i] > 0) || undefined}
          >
            {say(t.label)}
            <span className="gg-tabs__count">{counts[i]}</span>
          </Link>
        ))}
        <OrderDay
          day={day}
          anyDay={orderTabQuery(current, { search })}
          onDay={orderTabQuery(current, { search, day: 'DAY' })}
          label={say(l('Jour du créneau', 'Slot day', 'Tag des Zeitfensters', 'Dia do horário'))}
          clear={say(l('Tous les jours', 'Any day', 'Alle Tage', 'Todos os dias'))}
        />
      </nav>
      {active && !search && (
        <EmptyList
          data={data}
          i18n={i18n}
          icon="orders"
          title={active.empty}
          text={l(
            'Les autres commandes sont dans les onglets ci-dessus. « Toutes » permet de retrouver n’importe laquelle.',
            'Other orders are in the tabs above. “All” finds any order.',
            'Die übrigen Bestellungen finden Sie in den Reitern oben. „Alle“ findet jede Bestellung.',
            'As outras encomendas estão nos separadores acima. «Todas» encontra qualquer encomenda.',
          )}
          evenFiltered
        />
      )}
    </>
  );
}
