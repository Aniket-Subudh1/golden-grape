import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Scale,
  Settings,
  Wine,
} from 'lucide-react';
import type { AdminViewServerProps } from 'payload';
import type { ReactNode } from 'react';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import CreateButton from './create-button';
import { eventDate, toLocal, TZ } from '@/lib/time';

// The admin home (Payload `admin.components.views.dashboard`), in the CUTM LMS home layout: title row, quick actions,
// then what needs attention and the upcoming events on the left, recent requests and figures on the right.
// No navigation cards: the sidebar already lists every section. Blocks appear only for roles that may open them.

type Attention = { key: string; href: string; title: string; detail: string; badge: string; tone: 'danger' | 'warning' };

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });

function Section({ title, description, href, children }: { title: string; description: string; href?: string; children: ReactNode }) {
  return (
    <section className="gg-card" aria-label={title}>
      <header className="gg-card__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {href && (
          <a href={href} className="gg-card__more">
            View all <ChevronRight />
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

  const now = new Date();
  const editor = hasRole(user, ['manager']);
  const sales = hasRole(user, ['sales']);
  const firstName = (user.name ?? '').split(' ')[0];

  const [requests, newCount, upcoming, drafts, legalDrafts, media, settings] = await Promise.all([
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
  ]);

  const attention: Attention[] = [
    ...(requests?.docs ?? [])
      .filter((r) => r.status === 'new')
      .map((r) => ({
        key: r.id,
        href: `/admin/collections/cateringRequests/${r.id}`,
        title: `Catering request ${r.number}`,
        detail: `${r.contact.name} · ${r.guests} guests · ${shortFmt.format(new Date(r.date))}`,
        badge: 'New',
        tone: 'danger' as const,
      })),
    ...(upcoming && upcoming.totalDocs === 0
      ? [{ key: 'no-events', href: '/admin/collections/events', title: 'No upcoming event is published', detail: 'The events page shows "no upcoming events" until one is dated and published.', badge: 'Website', tone: 'warning' as const }]
      : []),
    ...(legalDrafts?.totalDocs
      ? [{ key: 'legal', href: '/admin/collections/legal', title: `${legalDrafts.totalDocs} legal pages are still drafts`, detail: 'Publish them once the final texts are in, then they appear in the footer.', badge: 'Draft', tone: 'warning' as const }]
      : []),
    ...(settings && !settings.business.facebook
      ? [{ key: 'facebook', href: '/admin/globals/BusinessSettings', title: 'Facebook page link is missing', detail: 'Add it in Business settings to show the icon on the website.', badge: 'Settings', tone: 'warning' as const }]
      : []),
  ];

  const actions: { label: string; href: string; icon: ReactNode; external?: boolean }[] = [
    ...(editor
      ? [
          { label: 'Happy Hour', href: '/admin/globals/HappyHour', icon: <Wine /> },
          { label: 'Business settings', href: '/admin/globals/BusinessSettings', icon: <Settings /> },
        ]
      : []),
    ...(sales ? [{ label: 'Catering requests', href: '/admin/collections/cateringRequests', icon: <ClipboardList /> }] : []),
    { label: 'View the website', href: '/fr', icon: <ExternalLink />, external: true },
  ];

  return (
    <div className="gg-page gg-home">
      <div className="gg-home__title">
        <h1>
          <span className="gg-home__title-icon">
            <LayoutDashboard />
          </span>
          {greeting(toLocal(now).hour)}
          {firstName && `, ${firstName}`}
        </h1>
        <p>{dateFmt.format(now)}</p>
      </div>

      <nav aria-label="Quick actions" className="gg-actions">
        {editor && (
          <>
            <CreateButton collectionSlug="events" label="New event" />
            <CreateButton collectionSlug="media" label="Upload photos" quiet />
          </>
        )}
        {actions.map((a) => (
          <a key={a.label} href={a.href} className="gg-btn" {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {a.icon}
            {a.label}
          </a>
        ))}
      </nav>

      <div className="gg-home__grid">
        <div className="gg-home__col">
          {!editor && !sales && (
            <Section title="Nothing to manage yet" description="Your sections appear in the menu as they are switched on.">
              <Empty>Ask the owner if you expected to see events, catering or settings here.</Empty>
            </Section>
          )}
          {(editor || sales) && (
            <Section title="Needs your attention" description="Things to do first, most urgent at the top.">
              {attention.length === 0 ? (
                <Empty>Nothing waiting. Everything is up to date.</Empty>
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
            <Section title="Upcoming events" description="Published events, soonest first." href="/admin/collections/events">
              {upcoming.docs.length === 0 ? (
                <Empty>No upcoming event. Add a date to an event and publish it.</Empty>
              ) : (
                <ul className="gg-list">
                  {upcoming.docs.map((e) => {
                    const d = eventDate(e.startsAt, e.endsAt, 'en-GB');
                    const start = new Date(e.startsAt);
                    return (
                      <li key={e.id}>
                        <a href={`/admin/collections/events/${e.id}`} className="gg-list__row">
                          <span className="gg-date">
                            <span>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: TZ }).format(start)}</span>
                            <b>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: TZ }).format(start)}</b>
                          </span>
                          <span className="gg-list__text">
                            <span className="gg-list__title">{e.title}</span>
                            <span className="gg-list__detail">
                              {d.date} · {d.time}
                            </span>
                          </span>
                          <span className="gg-list__meta">{e.priceCents ? formatMoney(e.priceCents, 'fr', { compact: true }) : 'Free'}</span>
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
            <Section title="Recent catering requests" description="The last five, newest first." href="/admin/collections/cateringRequests">
              {requests.docs.length === 0 ? (
                <Empty>No catering request yet.</Empty>
              ) : (
                <ul className="gg-list">
                  {requests.docs.map((r) => (
                    <li key={r.id}>
                      <a href={`/admin/collections/cateringRequests/${r.id}`} className="gg-list__row">
                        <span className="gg-list__text">
                          <span className="gg-list__title">{r.contact.name}</span>
                          <span className="gg-list__detail">
                            {r.number} · {r.guests} guests · {formatMoney(r.estimateCents, 'fr', { compact: true })}
                          </span>
                        </span>
                        <span className={`gg-badge gg-badge--${r.status === 'new' ? 'danger' : 'neutral'}`}>{r.status}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {editor && (
            <Section title="At a glance" description="What the website holds today.">
              <dl className="gg-facts">
                <div>
                  <dt>
                    <CalendarDays /> Upcoming events
                  </dt>
                  <dd>{upcoming?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays /> Event drafts
                  </dt>
                  <dd>{drafts?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <ClipboardList /> New requests
                  </dt>
                  <dd>{newCount?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <ImagePlus /> Photos
                  </dt>
                  <dd>{media?.totalDocs ?? 0}</dd>
                </div>
                <div>
                  <dt>
                    <Scale /> Legal drafts
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
