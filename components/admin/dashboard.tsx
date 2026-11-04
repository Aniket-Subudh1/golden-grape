import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Scale,
  Settings,
  TriangleAlert,
  Wine,
} from 'lucide-react';
import type { AdminViewServerProps } from 'payload';
import type { ReactNode } from 'react';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { REQUEST_STATUS } from '@/modules/catering/collections';
import CreateButton from './create-button';
import { adminText, type AdminLanguage } from './text';
import { eventDate, toLocal, TZ } from '@/lib/time';

// The admin home (Payload `admin.components.views.dashboard`), in the CUTM LMS home layout: title row, quick actions,
// then what needs attention and the upcoming events on the left, recent requests and figures on the right.
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

  const [requests, newCount, upcoming, drafts, legalDrafts, media, settings, lowStock] = await Promise.all([
    sales ? payload.find({ collection: 'cateringRequests', sort: '-createdAt', limit: 5, depth: 1, overrideAccess: true }) : null,
    sales ? payload.count({ collection: 'cateringRequests', where: { status: { equals: 'new' } }, overrideAccess: true }) : null,
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
    editor ? payload.count({ collection: 'events', where: { _status: { equals: 'draft' } }, overrideAccess: true }) : null,
    editor ? payload.count({ collection: 'legal', where: { _status: { equals: 'draft' } }, overrideAccess: true }) : null,
    editor ? payload.count({ collection: 'media', overrideAccess: true }) : null,
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

  return (
    <div className="gg-page gg-home">
      <div className="gg-home__title">
        <h1>
          <span className="gg-home__title-icon">
            <LayoutDashboard />
          </span>
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
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

          {upcoming && (
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
          )}
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

          {editor && (
            <Section title={t.home.glance} description={t.home.glanceText}>
              <dl className="gg-facts">
                <div>
                  <dt>
                    <CalendarDays /> {t.home.upcomingCount}
                  </dt>
                  <dd>{upcoming?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays /> {t.home.eventDrafts}
                  </dt>
                  <dd>{drafts?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <ClipboardList /> {t.home.newRequests}
                  </dt>
                  <dd>{newCount?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <ImagePlus /> {t.home.photos}
                  </dt>
                  <dd>{media?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <Scale /> {t.home.legalDrafts}
                  </dt>
                  <dd>{legalDrafts?.totalDocs ?? 0}</dd>
                </div>
              </dl>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
