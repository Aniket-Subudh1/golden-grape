import {
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Euro,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingBasket,
  Ticket,
  TriangleAlert,
  UsersRound,
  Wine,
} from 'lucide-react';
import type { AdminViewServerProps } from 'payload';
import type { ReactNode } from 'react';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { REQUEST_STATUS } from '@/modules/catering/collections';
import { SOLD, salesOverview } from '@/modules/reporting/service';
import type { Range } from '@/modules/reporting/summary';
import CreateButton from './create-button';
import { actionCounts, type CounterKey, listUrl } from './alerts';
import { statusTabQuery } from './status-tabs';
import { RESERVATION_TABS } from '@/modules/sales/collections';
import { adminText, type AdminLanguage } from './text';
import { eventDate, toLocal, today, TZ } from '@/lib/time';
import { transferAccount } from '@/modules/settings/service';

// The admin home (Payload `admin.components.views.dashboard`), laid out like the Ancora dashboard: title row, quick
// actions, the tiles of what waits (sales staff), the key figures (managers), then what needs attention and the
// upcoming events on the left, recent requests on the right. Every tile opens the list its figure comes from.
// No navigation cards: the sidebar already lists every section. Blocks appear only for roles that may open them.

type Attention = { key: string; href: string; title: string; detail: string; badge: string; tone: 'danger' | 'warning' };

const LOW_STOCK = '/admin/collections/stockLevels?where[lowStock][equals]=true';

const LANGUAGE_TAGS: Record<AdminLanguage, string> = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', pt: 'pt-PT' };

function Section({ title, description, href, moreLabel, children }: { title: string; description: string; href?: string; moreLabel?: string; children: ReactNode }) {
  return (
    <section className="gg-card" aria-label={title}>
      <header className="gg-card__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {href && (
          <a href={href} className="gg-card__more">
            {moreLabel} <ChevronRight />
          </a>
        )}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="gg-card__empty">{children}</p>;
}

type Trend = { text: string; up: boolean };

/** One figure (Ancora's metric tile): label, value, a line of context, an icon; tinted when something waits. */
function Tile({ href, icon, label, value, hint, trend, tone }: { href: string; icon: ReactNode; label: string; value: string; hint: string; trend?: Trend; tone?: 'warning' | 'danger' }) {
  return (
    <a href={href} className="gg-tile" data-tone={tone}>
      <span className="gg-tile__label">{label}</span>
      <span className="gg-tile__icon">{icon}</span>
      <span className="gg-tile__value">{value}</span>
      <span className="gg-tile__hint">
        {trend && (
          <span className="gg-tile__trend" data-up={trend.up || undefined}>
            {trend.text}
          </span>
        )}
        {hint}
      </span>
    </a>
  );
}

const COUNTER_ICONS: Record<CounterKey, ReactNode> = {
  toConfirm: <ShoppingBag />,
  awaitingPayment: <Landmark />,
  toPrepare: <PackageCheck />,
  reservations: <CalendarCheck />,
  catering: <ClipboardList />,
  eventBookings: <Ticket />,
  refunds: <RotateCcw />,
};

/** The sold orders of a range in the order list: the list the sales figures equal (AC-M3.3-06). */
const soldUrl = ({ from, to }: Range) =>
  listUrl('orders', {
    'where[and][0][slot.date][greater_than_equal]': from,
    'where[and][1][slot.date][less_than_equal]': to,
    ...Object.fromEntries(SOLD.map((status, i) => [`where[and][2][status][in][${i}]`, status])),
    sort: '-slotAt',
  });

export default async function Dashboard({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  const { payload, user } = req;
  if (user?.collection !== 'users') return null;

  const language = (req.i18n.language in LANGUAGE_TAGS ? req.i18n.language : 'fr') as AdminLanguage;
  const locale = LANGUAGE_TAGS[language];
  const t = adminText(language);
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  const shortFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: TZ });
  const now = new Date();
  const editor = hasRole(user, ['manager']);
  const sales = hasRole(user, ['sales']);
  const stock = hasRole(user, ['manager', 'stock']);
  const firstName = (user.name ?? '').split(' ')[0];
  const greeting = t.home.greeting[toLocal(now).hour < 12 ? 0 : toLocal(now).hour < 18 ? 1 : 2];

  const day = today(now);
  const [counters, overview, booked, requests, upcoming, legalDrafts, settings, lowStock] = await Promise.all([
    actionCounts(payload, user),
    editor ? salesOverview(payload, now) : null,
    sales
      ? payload.find({
          collection: 'reservations',
          where: { 'slot.date': { equals: day }, status: { in: ['pending', 'accepted', 'completed'] } },
          select: { guests: true, status: true },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
      : null,
    sales ? payload.find({ collection: 'cateringRequests', sort: '-createdAt', limit: 5, depth: 1, overrideAccess: true }) : null,
    editor
      ? payload.find({
          collection: 'events',
          where: { _status: { equals: 'published' }, startsAt: { greater_than_equal: now.toISOString() } },
          sort: 'startsAt',
          limit: 5,
          depth: 0,
          overrideAccess: true,
        })
      : null,
    editor ? payload.count({ collection: 'legal', where: { _status: { equals: 'draft' } }, overrideAccess: true }) : null,
    editor ? payload.findGlobal({ slug: 'BusinessSettings', overrideAccess: true, depth: 0 }) : null,
    stock ? payload.count({ collection: 'stockLevels', where: { lowStock: { equals: true } }, overrideAccess: true }) : null,
  ]);

  const attention: Attention[] = [
    ...(requests?.docs ?? [])
      .filter((r) => r.status === 'new')
      .map((r) => ({
        key: r.id,
        href: `/admin/collections/cateringRequests/${r.id}`,
        title: t.home.requestTitle(r.number),
        detail: `${r.contact.name} · ${r.guests} ${t.home.guests} · ${shortFmt.format(new Date(r.date))}`,
        badge: t.home.newBadge,
        tone: 'danger' as const,
      })),
    ...(lowStock?.totalDocs
      ? [{ key: 'low-stock', href: LOW_STOCK, title: t.home.lowStockTitle(lowStock.totalDocs), detail: t.home.lowStockText, badge: t.home.stockBadge, tone: 'warning' as const }]
      : []),
    ...(upcoming && upcoming.totalDocs === 0
      ? [{ key: 'no-events', href: '/admin/collections/events', title: t.home.noEventTitle, detail: t.home.noEventText, badge: t.home.websiteBadge, tone: 'warning' as const }]
      : []),
    ...(legalDrafts?.totalDocs
      ? [{ key: 'legal', href: '/admin/collections/legal', title: t.home.legalTitle(legalDrafts.totalDocs), detail: t.home.legalText, badge: t.home.draftBadge, tone: 'warning' as const }]
      : []),
    ...(settings && !transferAccount(settings.business.bankAccounts)
      ? [{ key: 'iban', href: '/admin/globals/BusinessSettings', title: t.home.ibanTitle, detail: t.home.ibanText, badge: t.home.settingsBadge, tone: 'danger' as const }]
      : []),
    ...(settings && !settings.business.facebook
      ? [{ key: 'facebook', href: '/admin/globals/BusinessSettings', title: t.home.facebookTitle, detail: t.home.facebookText, badge: t.home.settingsBadge, tone: 'warning' as const }]
      : []),
  ];

  const actions: { label: string; href: string; icon: ReactNode; external?: boolean }[] = [
    ...(editor
      ? [
          { label: t.home.changeHome, href: '/admin/globals/HomePage', icon: <LayoutDashboard /> },
          { label: t.home.changeHappyHour, href: '/admin/globals/HappyHour', icon: <Wine /> },
          { label: t.home.changeHours, href: '/admin/globals/BusinessSettings', icon: <Settings /> },
        ]
      : []),
    ...(stock ? [{ label: t.home.seeLowStock, href: LOW_STOCK, icon: <TriangleAlert /> }] : []),
    ...(sales ? [{ label: t.home.seeRequests, href: '/admin/collections/cateringRequests', icon: <ClipboardList /> }] : []),
    { label: t.nav.viewSite, href: '/fr', icon: <ExternalLink />, external: true },
  ];

  // Context for the figures: a duration since a date, a change against a previous figure, a range of days.
  const unit = (n: number, u: 'minute' | 'hour' | 'day') => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' }).format(n);
  const ago = (at: string) => {
    const minutes = Math.max(1, Math.round((now.getTime() - new Date(at).getTime()) / 60_000));
    return minutes < 60 ? unit(minutes, 'minute') : minutes < 48 * 60 ? unit(Math.round(minutes / 60), 'hour') : unit(Math.round(minutes / 1440), 'day');
  };
  const trend = (current: number, previous: number): Trend | undefined =>
    previous > 0
      ? { text: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format((current - previous) / previous), up: current >= previous }
      : undefined;
  const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);
  const rangeLabel = ({ from, to }: Range) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).formatRange(dayOf(from), dayOf(to));
  const money = (cents: number) => formatMoney(cents, locale);
  const k = t.home.kpi;

  const tables = booked?.docs.filter((r) => r.status !== 'pending') ?? [];
  const pendingGuests = (booked?.docs ?? []).filter((r) => r.status === 'pending').reduce((sum, r) => sum + (r.guests ?? 0), 0);
  const guestsHint = booked?.docs.length ? [k.tables(tables.length), pendingGuests ? k.toConfirm(t.home.counters.people(pendingGuests)) : null].filter(Boolean).join(' · ') : k.none;

  // Upcoming events sit under the attention list, or in the right column when there are no requests to show there.
  const upcomingCard = upcoming && (
    <Section title={t.home.upcoming} description={t.home.upcomingText} href="/admin/collections/events" moreLabel={t.home.viewAll}>
      {upcoming.docs.length === 0 ? (
        <Empty>{t.home.noUpcoming}</Empty>
      ) : (
        <ul className="gg-list">
          {upcoming.docs.map((e) => {
            const d = eventDate(e.startsAt, e.endsAt, locale);
            const start = new Date(e.startsAt);
            return (
              <li key={e.id}>
                <a href={`/admin/collections/events/${e.id}`} className="gg-list__row">
                  <span className="gg-date">
                    <span>{new Intl.DateTimeFormat(locale, { month: 'short', timeZone: TZ }).format(start)}</span>
                    <b>{new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: TZ }).format(start)}</b>
                  </span>
                  <span className="gg-list__text">
                    <span className="gg-list__title">{e.title}</span>
                    <span className="gg-list__detail">
                      {d.date} · {d.time}
                    </span>
                  </span>
                  <span className="gg-list__meta">{e.priceCents ? formatMoney(e.priceCents, locale, { compact: true }) : t.home.free}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  return (
    <div className="gg-page gg-home">
      <div className="gg-home__title">
        <h1>{firstName ? `${greeting}, ${firstName}` : greeting}</h1>
        <p>{dateFmt.format(now)}</p>
      </div>

      <nav aria-label={t.home.quickActions} className="gg-actions">
        {editor && (
          <>
            <CreateButton collectionSlug="events" label={t.home.addEvent} />
            <CreateButton collectionSlug="media" label={t.home.uploadPhotos} quiet />
          </>
        )}
        {stock && <CreateButton collectionSlug="stockCounts" label={t.home.newCount} quiet={editor} />}
        {actions.map((a) => (
          <a key={a.label} href={a.href} className="gg-btn" {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {a.icon}
            {a.label}
          </a>
        ))}
      </nav>

      {/* GG-045: what waits for a decision, one tile per kind; each opens the matching list. Same figures as the sidebar and bell. */}
      {counters.length > 0 && (
        <section className="gg-tiles-block" aria-labelledby="gg-waiting">
          <h2 id="gg-waiting" className="gg-home__label">
            {t.home.counters.title}
          </h2>
          <div className="gg-tiles">
            {counters.map((c) => (
              <Tile
                key={c.key}
                href={c.href}
                icon={COUNTER_ICONS[c.key]}
                label={t.home.counters[c.key]}
                value={String(c.count)}
                hint={
                  c.count
                    ? [c.unit === 'cents' ? money(c.sum) : t.home.counters.people(c.sum), c.oldestAt ? t.home.counters.since(ago(c.oldestAt)) : null].filter(Boolean).join(' · ')
                    : t.home.counters.none
                }
                tone={c.count ? (c.key === 'refunds' ? 'danger' : 'warning') : undefined}
              />
            ))}
            {booked && (
              <Tile
                href={`/admin/collections/reservations${statusTabQuery(RESERVATION_TABS[0])}`}
                icon={<UsersRound />}
                label={k.guestsToday}
                value={String(tables.reduce((sum, r) => sum + (r.guests ?? 0), 0))}
                hint={guestsHint}
              />
            )}
          </div>
        </section>
      )}

      {/* Sales by slot day (modules/reporting): each tile opens the order list whose totals it equals. */}
      {overview && (
        <section className="gg-tiles-block" aria-labelledby="gg-kpi">
          <div className="gg-home__label">
            <h2 id="gg-kpi">{k.title}</h2>
            <p>{k.note}</p>
          </div>
          <div className="gg-tiles">
            <Tile
              href={soldUrl(overview.periods.today)}
              icon={<Euro />}
              label={k.salesToday}
              value={money(overview.today.grossCents)}
              hint={k.compare(k.yesterday, money(overview.yesterday.grossCents))}
              trend={trend(overview.today.grossCents, overview.yesterday.grossCents)}
            />
            <Tile
              href={soldUrl(overview.periods.month)}
              icon={<Receipt />}
              label={k.salesMonth}
              value={money(overview.month.grossCents)}
              hint={k.compare(rangeLabel(overview.periods.lastMonth), money(overview.lastMonth.grossCents))}
              trend={trend(overview.month.grossCents, overview.lastMonth.grossCents)}
            />
            <Tile
              href={soldUrl(overview.periods.today)}
              icon={<ShoppingBag />}
              label={k.ordersToday}
              value={String(overview.today.orders)}
              hint={k.compare(k.yesterday, String(overview.yesterday.orders))}
              trend={trend(overview.today.orders, overview.yesterday.orders)}
            />
            <Tile
              href={soldUrl(overview.periods.month)}
              icon={<ShoppingBasket />}
              label={k.basket}
              value={money(overview.month.averageCents)}
              hint={k.compare(rangeLabel(overview.periods.lastMonth), money(overview.lastMonth.averageCents))}
              trend={trend(overview.month.averageCents, overview.lastMonth.averageCents)}
            />
          </div>
        </section>
      )}

      <div className="gg-home__grid">
        <div className="gg-home__col">
          {!editor && !sales && !stock && (
            <Section title={t.home.emptyTitle} description={t.home.emptyText}>
              <Empty>{t.home.emptyBody}</Empty>
            </Section>
          )}
          {(editor || sales || stock) && (
            <Section title={t.home.attention} description={t.home.attentionText}>
              {attention.length === 0 ? (
                <Empty>{t.home.nothingWaiting}</Empty>
              ) : (
                <ul className="gg-list">
                  {attention.map((a) => (
                    <li key={a.key}>
                      <a href={a.href} className="gg-list__row">
                        <span className="gg-list__text">
                          <span className="gg-list__title">{a.title}</span>
                          <span className="gg-list__detail">{a.detail}</span>
                        </span>
                        <span className={`gg-badge gg-badge--${a.tone}`}>{a.badge}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {requests && upcomingCard}
        </div>

        <div className="gg-home__col">
          {requests && (
            <Section title={t.home.recentRequests} description={t.home.recentRequestsText} href="/admin/collections/cateringRequests" moreLabel={t.home.viewAll}>
              {requests.docs.length === 0 ? (
                <Empty>{t.home.noRequests}</Empty>
              ) : (
                <ul className="gg-list">
                  {requests.docs.map((r) => (
                    <li key={r.id}>
                      <a href={`/admin/collections/cateringRequests/${r.id}`} className="gg-list__row">
                        <span className="gg-list__text">
                          <span className="gg-list__title">{r.contact.name}</span>
                          <span className="gg-list__detail">
                            {r.number} · {r.guests} {t.home.guests} · {formatMoney(r.estimateCents, locale, { compact: true })}
                          </span>
                        </span>
                        <span className={`gg-badge gg-badge--${r.status === 'new' ? 'danger' : 'neutral'}`}>
                          {REQUEST_STATUS.find((status) => status.value === r.status)?.label[language] ?? r.status}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {!requests && upcomingCard}
        </div>
      </div>
    </div>
  );
}
