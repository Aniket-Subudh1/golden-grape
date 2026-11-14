import Link from 'next/link';
import type { CollectionSlug, PaginatedDocs, Payload, Where } from 'payload';
import { entriesOf, l, type Label, type StatusTab } from '@/lib/admin';
import { today } from '@/lib/time';
import EmptyList, { type EmptyIcon } from './empty-list';

// Stage tabs above a list (APPLUX report 4, §7; QA 12 Nov GG-04/06): table reservations and catering requests get the
// clarity of the Orders tabs without Payload's filter builder. A tab is a plain list query on `status`, optionally on
// the day, so the search, columns and paging keep working. Each count is the query its tab opens (search included),
// so a count never disagrees with the list; a filter that matches no tab is said, with a way back. Wired with
// `statusTabs()` (lib/admin.ts); the sidebar, the dashboard and the bell open tabs through `statusTabQuery`.

const DAY_OP = { today: 'equals', fromToday: 'greater_than_equal' } as const;

/** A tab's conditions as a Payload `where`. */
const whereOf = (tab: StatusTab, day: string): Where[] => [
  ...(tab.statuses ? [{ status: { in: tab.statuses } }] : []),
  ...(tab.day ? [{ 'slot.date': { [DAY_OP[tab.day]]: day } }] : []),
];

/** The list URL's query for a tab, keeping the search. */
export function statusTabQuery(tab: StatusTab, search = '') {
  const params = new URLSearchParams();
  let i = 0;
  if (tab.statuses) {
    tab.statuses.forEach((status, n) => params.set(`where[and][${i}][status][in][${n}]`, status));
    i++;
  }
  if (tab.day) params.set(`where[and][${i}][slot.date][${DAY_OP[tab.day]}]`, today());
  if (search) params.set('search', search);
  if (tab.sort) params.set('sort', tab.sort);
  return `?${params.toString()}`;
}

const STATUS = /\[status\]\[(in|equals)\](\[\d+\])?$/;
const DAY = /\[slot\.date\]\[(equals|greater_than_equal)\]$/;
/** What identifies a tab in a URL: its statuses (any order) and its day condition. */
const keyOf = (statuses: string[], day: string) => `${statuses.toSorted().join(',')}|${day}`;

export const TAB_TEXT = {
  filter: l('Filtre actif', 'Filter on', 'Filter aktiv', 'Filtro ativo'),
  clear: l('Effacer le filtre', 'Clear the filter', 'Filter entfernen', 'Limpar o filtro'),
  others: l('Voir les autres onglets :', 'See the other tabs:', 'Andere Reiter ansehen:', 'Ver os outros separadores:'),
  nothing: l('Rien dans les autres onglets non plus.', 'Nothing in the other tabs either.', 'Auch in den anderen Reitern nichts.', 'Também nada nos outros separadores.'),
};

type Props = {
  payload: Payload;
  data?: PaginatedDocs;
  searchParams?: Record<string, unknown>;
  listSearchableFields?: string[];
  collectionConfig?: { admin?: { useAsTitle?: string } };
  i18n?: { language: string };
  collection: CollectionSlug;
  tabs: StatusTab[];
  icon?: EmptyIcon;
};

export default async function StatusTabs({ payload, data, searchParams = {}, listSearchableFields = [], collectionConfig, i18n, collection, tabs, icon }: Props) {
  const lang = (i18n?.language ?? 'fr') as keyof Label;
  const say = (label: Label) => label[lang] ?? label.fr;
  const day = today();
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';

  // Which tab the URL is: its statuses and day, and nothing else filtered.
  const where = entriesOf(searchParams).filter(([key]) => key.startsWith('where'));
  const statuses = where.filter(([key]) => STATUS.test(key)).flatMap(([, value]) => value.split(','));
  const dayEntry = where.find(([key]) => DAY.test(key));
  const custom = where.some(([key]) => !STATUS.test(key) && !DAY.test(key));
  const current = keyOf(statuses, dayEntry ? `${DAY.exec(dayEntry[0])![1]}:${dayEntry[1]}` : '');
  const active = custom ? undefined : tabs.find((t) => keyOf(t.statuses ?? [], t.day ? `${DAY_OP[t.day]}:${day}` : '') === current);
  const filtered = where.length > 0 && !active;

  // The counts follow the search exactly as Payload applies it (`like` on the searchable fields, else the title).
  const fields = listSearchableFields.length ? listSearchableFields : [collectionConfig?.admin?.useAsTitle ?? 'id'];
  const base: Where[] = search ? [{ or: fields.map((f) => ({ [f]: { like: search } })) }] : [];
  const counts = await Promise.all(tabs.map((t) => payload.count({ collection, where: { and: [...base, ...whereOf(t, day)] }, overrideAccess: true }).then((r) => r.totalDocs)));
  const others = tabs.map((t, i) => ({ href: statusTabQuery(t, search), label: `${say(t.label)} (${counts[i]})`, count: counts[i], tab: t })).filter((o) => o.count > 0 && o.tab !== active);

  return (
    <>
      <nav className="gg-tabs">
        {tabs.map((t, i) => (
          <Link key={i} href={statusTabQuery(t, search)} className="gg-tabs__tab" data-active={t === active || undefined} data-urgent={(t.urgent && counts[i] > 0) || undefined}>
            {say(t.label)}
            <span className="gg-tabs__count">{counts[i]}</span>
          </Link>
        ))}
        {filtered && (
          <span className="gg-tabs__filter">
            {say(TAB_TEXT.filter)} · <Link href={statusTabQuery(tabs.find((t) => t.opens) ?? tabs[0], search)}>{say(TAB_TEXT.clear)}</Link>
          </span>
        )}
      </nav>
      {active?.empty && icon && !search && (
        <EmptyList data={data} i18n={i18n} icon={icon} title={active.empty} text={others.length ? TAB_TEXT.others : TAB_TEXT.nothing} links={others.map(({ href, label }) => ({ href, label }))} evenFiltered />
      )}
    </>
  );
}
