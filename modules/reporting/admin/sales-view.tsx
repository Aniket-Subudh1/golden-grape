import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { addDays, today } from '@/lib/time';
import { orderViewUrl } from '@/modules/sales/admin/order-filters';
import { langOf } from '@/modules/sales/admin/text';
import { CHANNELS, GROUP_BY, type GroupBy, salesBy } from '../service';
import { ExportSales } from './export-button';

// The sales dashboard (/admin/sales, R8, M3.3 T4): a range, a channel, a grouping; the totals (equal to the order
// list for the same days, AC-M3.3-06), a bar per group and the table, as CSV. Admin and managers only.

const TEXT = {
  fr: { title: 'Ventes', subtitle: 'Les commandes vendues (confirmées à remises), par jour de retrait ou de livraison, remboursements déduits. Les totaux sont ceux de la liste des commandes pour les mêmes jours.', today: 'Aujourd’hui', week: '7 jours', month: 'Ce mois', custom: 'Période', from: 'Du', to: 'Au', show: 'Afficher', allChannels: 'Tous les canaux', channels: { webshop: 'Site', mobile: 'Équipe (mobile)', pos: 'Caisse' }, groups: { day: 'Jour', channel: 'Canal', customer: 'Client', product: 'Produit', brand: 'Producteur', category: 'Catégorie' }, gross: 'Chiffre d’affaires TTC', net: 'Hors TVA', vat: 'TVA', orders: 'Commandes', average: 'Panier moyen', refunded: 'Remboursé', qty: 'Bouteilles / unités', none: { customer: 'Sans compte', brand: 'Sans producteur', category: '—', product: '—', day: '—', channel: '—' }, total: 'Total', lineNote: 'Par article : les lignes telles que facturées (après promotions et code). Livraison et remboursements seulement dans le total.', empty: 'Aucune vente sur cette période.', export: 'Exporter en CSV', error: 'Export impossible.', forbidden: 'Votre rôle ne permet pas de voir cette page.', open: 'Voir ces commandes' },
  en: { title: 'Sales', subtitle: 'Orders sold (confirmed to handed over), by pickup or delivery day, refunds deducted. The totals are the order list’s for the same days.', today: 'Today', week: '7 days', month: 'This month', custom: 'Period', from: 'From', to: 'To', show: 'Show', allChannels: 'All channels', channels: { webshop: 'Website', mobile: 'Team (mobile)', pos: 'Till' }, groups: { day: 'Day', channel: 'Channel', customer: 'Customer', product: 'Product', brand: 'Producer', category: 'Category' }, gross: 'Revenue incl. VAT', net: 'Excl. VAT', vat: 'VAT', orders: 'Orders', average: 'Average basket', refunded: 'Refunded', qty: 'Bottles / units', none: { customer: 'No account', brand: 'No producer', category: '—', product: '—', day: '—', channel: '—' }, total: 'Total', lineNote: 'By item: the lines as charged (after promotions and the code). Delivery and refunds only in the total.', empty: 'No sales in this period.', export: 'Export CSV', error: 'Could not export.', forbidden: 'Your role cannot see this page.', open: 'See these orders' },
  de: { title: 'Verkäufe', subtitle: 'Verkaufte Bestellungen (bestätigt bis übergeben), nach Abhol- oder Liefertag, Erstattungen abgezogen. Die Summen entsprechen der Bestellliste für dieselben Tage.', today: 'Heute', week: '7 Tage', month: 'Dieser Monat', custom: 'Zeitraum', from: 'Von', to: 'Bis', show: 'Anzeigen', allChannels: 'Alle Kanäle', channels: { webshop: 'Website', mobile: 'Team (mobil)', pos: 'Kasse' }, groups: { day: 'Tag', channel: 'Kanal', customer: 'Kunde', product: 'Produkt', brand: 'Erzeuger', category: 'Kategorie' }, gross: 'Umsatz inkl. MwSt.', net: 'Netto', vat: 'MwSt.', orders: 'Bestellungen', average: 'Ø Warenkorb', refunded: 'Erstattet', qty: 'Flaschen / Stück', none: { customer: 'Ohne Konto', brand: 'Ohne Erzeuger', category: '—', product: '—', day: '—', channel: '—' }, total: 'Summe', lineNote: 'Nach Artikel: die Zeilen wie berechnet (nach Aktionen und Code). Lieferung und Erstattungen nur in der Summe.', empty: 'Keine Verkäufe in diesem Zeitraum.', export: 'CSV exportieren', error: 'Export nicht möglich.', forbidden: 'Ihre Rolle darf diese Seite nicht sehen.', open: 'Diese Bestellungen ansehen' },
  pt: { title: 'Vendas', subtitle: 'Encomendas vendidas (confirmadas a entregues), por dia de recolha ou entrega, reembolsos deduzidos. Os totais são os da lista de encomendas para os mesmos dias.', today: 'Hoje', week: '7 dias', month: 'Este mês', custom: 'Período', from: 'De', to: 'Até', show: 'Mostrar', allChannels: 'Todos os canais', channels: { webshop: 'Site', mobile: 'Equipa (telemóvel)', pos: 'Caixa' }, groups: { day: 'Dia', channel: 'Canal', customer: 'Cliente', product: 'Produto', brand: 'Produtor', category: 'Categoria' }, gross: 'Faturação c/ IVA', net: 'Sem IVA', vat: 'IVA', orders: 'Encomendas', average: 'Cesto médio', refunded: 'Reembolsado', qty: 'Garrafas / unidades', none: { customer: 'Sem conta', brand: 'Sem produtor', category: '—', product: '—', day: '—', channel: '—' }, total: 'Total', lineNote: 'Por artigo: as linhas como faturadas (após promoções e código). Entrega e reembolsos só no total.', empty: 'Sem vendas neste período.', export: 'Exportar CSV', error: 'Não foi possível exportar.', forbidden: 'A sua função não permite ver esta página.', open: 'Ver estas encomendas' },
};

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function SalesView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Fsales');
  const lang = langOf(req.i18n.language);
  const t = TEXT[lang];
  const allowed = hasRole(req.user, ['manager']);
  const sp = searchParams ?? {};
  const now = today();
  const preset = (['today', 'week', 'month', 'custom'] as const).find((p) => p === sp.range) ?? 'month';
  const from = preset === 'today' ? now : preset === 'week' ? addDays(now, -6) : preset === 'custom' && isDay(sp.from) ? sp.from : `${now.slice(0, 7)}-01`;
  const to = preset === 'custom' && isDay(sp.to) && sp.to >= from ? sp.to : now;
  const groupBy: GroupBy = GROUP_BY.find((g) => g === sp.group) ?? 'day';
  const channel = CHANNELS.find((c) => c === sp.channel);
  const data = allowed ? await salesBy(req.payload, { from, to, channel, groupBy, locale: lang }) : null;
  const money = (cents: number) => formatMoney(cents, lang);
  const dayLabel = (day: string) => new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const labelOf = (key: string | null, label: string) =>
    groupBy === 'day' ? dayLabel(key!) : groupBy === 'channel' ? (t.channels[key as keyof typeof t.channels] ?? key) : label || t.none[groupBy];
  const link = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { range: preset, from: preset === 'custom' ? from : undefined, to: preset === 'custom' ? to : undefined, group: groupBy, channel, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/sales?${q}`;
  };
  const max = Math.max(1, ...(data?.groups ?? []).map((g) => g.grossCents));

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user} visibleEntities={visibleEntities}>
      <Gutter>
        <div className="gg-home gg-sales">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {!data ? (
            <p className="gg-card__empty">{t.forbidden}</p>
          ) : (
            <>
              <section className="gg-card">
                <div className="gg-sales__filters">
                  <nav className="gg-tabs" aria-label={t.custom}>
                    {(['today', 'week', 'month'] as const).map((p) => (
                      <a key={p} href={link({ range: p, from: undefined, to: undefined })} className="gg-tabs__tab" data-active={preset === p || undefined}>
                        {t[p]}
                      </a>
                    ))}
                  </nav>
                  <form method="get" action="/admin/sales" className="gg-sales__custom">
                    <input type="hidden" name="range" value="custom" />
                    <input type="hidden" name="group" value={groupBy} />
                    <label className="gg-io__date">
                      <span>{t.from}</span>
                      <input type="date" name="from" defaultValue={from} max={now} />
                    </label>
                    <label className="gg-io__date">
                      <span>{t.to}</span>
                      <input type="date" name="to" defaultValue={to} max={now} />
                    </label>
                    <label className="gg-io__date">
                      <span>{t.groups.channel}</span>
                      <select name="channel" defaultValue={channel ?? ''}>
                        <option value="">{t.allChannels}</option>
                        {CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {t.channels[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="gg-btn gg-btn--primary">
                      {t.show}
                    </button>
                  </form>
                </div>
              </section>

              <div className="gg-tiles" data-testid="sales-totals">
                {[
                  [t.gross, money(data.total.grossCents)],
                  [t.net, money(data.total.netCents)],
                  [t.vat, money(data.total.vatCents)],
                  [t.orders, String(data.total.orders)],
                  [t.average, money(data.total.averageCents)],
                  [t.refunded, money(data.total.refundedCents)],
                ].map(([label, value]) => (
                  <div key={label} className="gg-tile">
                    <span className="gg-tile__label">{label}</span>
                    <span className="gg-tile__value">{value}</span>
                  </div>
                ))}
              </div>

              <section className="gg-card">
                <header className="gg-card__head">
                  <nav className="gg-tabs" aria-label={t.groups.day}>
                    {GROUP_BY.map((g) => (
                      <a key={g} href={link({ group: g })} className="gg-tabs__tab" data-active={groupBy === g || undefined}>
                        {t.groups[g]}
                      </a>
                    ))}
                  </nav>
                  <span className="gg-actions">
                    <a className="gg-btn" href={orderViewUrl('sold', { from, to })}>
                      {t.open}
                    </a>
                    {data.groups.length > 0 && (
                      <ExportSales query={{ from, to, groupBy, channel, locale: lang, none: t.none[groupBy], total: t.total }} label={t.export} error={t.error} />
                    )}
                  </span>
                </header>
                {['product', 'brand', 'category'].includes(groupBy) && <p className="gg-sales__note">{t.lineNote}</p>}
                {data.groups.length === 0 ? (
                  <p className="gg-card__empty">{t.empty}</p>
                ) : (
                  <div className="gg-reorder">
                    <div className="table">
                      <table data-testid="sales-table">
                        <thead>
                          <tr>
                            <th>{t.groups[groupBy]}</th>
                            <th aria-hidden />
                            <th>{t.orders}</th>
                            {data.groups[0].qty !== null && <th>{t.qty}</th>}
                            <th>{t.gross}</th>
                            <th>{t.net}</th>
                            <th>{t.vat}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.groups.map((g) => (
                            <tr key={g.key ?? 'none'} data-group={g.key ?? ''}>
                              <td>{labelOf(g.key, g.label)}</td>
                              <td className="gg-sales__barcell">
                                <span className="gg-sales__bar" style={{ width: `${Math.max(2, Math.round((g.grossCents / max) * 100))}%` }} />
                              </td>
                              <td>{g.orders}</td>
                              {g.qty !== null && <td>{g.qty}</td>}
                              <td>
                                <b>{money(g.grossCents)}</b>
                              </td>
                              <td>{money(g.netCents)}</td>
                              <td>{money(g.vatCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>
                              <b>{t.total}</b>
                            </td>
                            <td />
                            <td>
                              <b>{data.total.orders}</b>
                            </td>
                            {data.groups[0].qty !== null && <td />}
                            <td>
                              <b>{money(data.total.grossCents)}</b>
                            </td>
                            <td>{money(data.total.netCents)}</td>
                            <td>{money(data.total.vatCents)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
