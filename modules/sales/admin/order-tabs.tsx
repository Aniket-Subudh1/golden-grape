import Link from 'next/link';
import type { PaginatedDocs, Payload, Where } from 'payload';
import { TAB_TEXT } from '@/components/admin/status-tabs';
import EmptyList from '@/components/admin/empty-list';
import { adminText } from '@/components/admin/text';
import { l, type Label } from '@/lib/admin';
import { matchOrderQuery, ORDER_TABS, orderTabQuery, orderTabWhere, type OrderView } from './order-filters';
import OrderDay from './order-day';

// The Orders list split by what staff must do (GG-001): one tab per stage, opened on "To do". Which tab is lit, or
// which shortcut is named, is `matchOrderQuery` (order-filters.ts): a lit tab is always exactly what is listed
// (GG-22). The tabs keep the search and the chosen day, and their counts follow both. "All" finds any order.

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
  const t = adminText(lang).home;
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';
  const { tab: active, view, filtered, day, range } = matchOrderQuery(searchParams);
  // The day picker stays on this tab ("All" under a shortcut or a filter set by hand in Payload's filters).
  const current = active ?? ORDER_TABS[ORDER_TABS.length - 1];

  // The counts match what the tab will show: same search (Payload's: `like` on the searchable fields) and day.
  const base: Where[] = [];
  if (day) base.push({ 'slot.date': { equals: day } });
  if (search) base.push({ or: listSearchableFields.map((f) => ({ [f]: { like: search } })) });
  const counts = await Promise.all(
    ORDER_TABS.map((tab) => payload.count({ collection: 'orders', where: { and: [...base, ...orderTabWhere(tab)] } }).then((r) => r.totalDocs)),
  );

  // A shortcut is named with the words of the tile or bell line that opened it, and its count is the rows listed.
  const VIEW_LABEL: Record<OrderView, string> = { toConfirm: t.counters.toConfirm, awaitingPayment: t.counters.awaitingPayment, refunds: t.counters.refunds, due: t.kpi.due, sold: t.kpi.sold };
  const dayLabel = (d: string) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const rangeLabel = range ? t.kpi.slots(dayLabel(range.from), dayLabel(range.to)) : null;

  return (
    <>
      <nav className="gg-tabs" aria-label={say(l('Étapes des commandes', 'Order stages', 'Bestellschritte', 'Etapas das encomendas'))}>
        {ORDER_TABS.map((tab, i) => (
          <Link
            key={tab.key}
            href={orderTabQuery(tab, { search, day })}
            className="gg-tabs__tab"
            data-active={tab === active || undefined}
            data-urgent={(i === 0 && counts[i] > 0) || undefined}
          >
            {say(tab.label)}
            <span className="gg-tabs__count">{counts[i]}</span>
          </Link>
        ))}
        {(view || filtered) && (
          <span className="gg-tabs__filter" data-active={view ? true : undefined}>
            {view ? (
              <b>
                {VIEW_LABEL[view]}
                {rangeLabel && ` · ${rangeLabel}`}
                <span className="gg-tabs__count">{data?.totalDocs ?? 0}</span>
              </b>
            ) : (
              say(TAB_TEXT.filter)
            )}{' '}
            · <Link href={orderTabQuery(ORDER_TABS[0], { search })}>{say(TAB_TEXT.clear)}</Link>
          </span>
        )}
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
            'Les autres commandes sont dans ces onglets :',
            'The other orders are in these tabs:',
            'Die übrigen Bestellungen finden Sie in diesen Reitern:',
            'As outras encomendas estão nestes separadores:',
          )}
          // Where the orders are instead (QA 12 Nov, GG-08): the stages that have some, "All" left out.
          links={ORDER_TABS.map((tab, i) => ({ tab, count: counts[i] }))
            .filter(({ tab, count }) => count > 0 && tab !== active && tab.statuses)
            .map(({ tab, count }) => ({ href: orderTabQuery(tab, { day }), label: `${say(tab.label)} (${count})` }))}
          evenFiltered
        />
      )}
    </>
  );
}
