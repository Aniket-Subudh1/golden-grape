import { CalendarDays, ClipboardList, Clock, ExternalLink, Images, Settings, Wine } from 'lucide-react';
import Image from 'next/image';
import type { Payload, TypedUser } from 'payload';
import type { ReactNode } from 'react';
import { hasRole } from '@/lib/access';
import { eventDate, toLocal, TZ } from '@/lib/time';

type Props = { payload: Payload; user: TypedUser | null };

type Stat = { label: string; value: number; hint: string; href: string; icon: ReactNode };
type Action = { label: string; href: string; icon: ReactNode; external?: boolean };

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

/**
 * Admin home (Payload `beforeDashboard`): greeting, the numbers that need attention, quick actions.
 * Each block is shown only to roles that may open it.
 */
export default async function DashboardHome({ payload, user }: Props) {
  if (user?.collection !== 'users') return null;
  const now = new Date();
  const local = toLocal(now);
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(now);
  const firstName = (user.name ?? '').split(' ')[0];
  const editor = hasRole(user, ['manager']);
  const sales = hasRole(user, ['sales']);

  const [newRequests, upcoming, media] = await Promise.all([
    sales ? payload.count({ collection: 'cateringRequests', where: { status: { equals: 'new' } }, overrideAccess: true }) : null,
    editor
      ? payload.find({
          collection: 'events',
          where: { _status: { equals: 'published' }, startsAt: { greater_than_equal: now.toISOString() } },
          sort: 'startsAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : null,
    editor ? payload.count({ collection: 'media', overrideAccess: true }) : null,
  ]);

  const next = upcoming?.docs[0];
  const statList: (Stat | null)[] = [
    newRequests && {
      label: 'New catering requests',
      value: newRequests.totalDocs,
      hint: newRequests.totalDocs ? 'Waiting for a quote' : 'All answered',
      href: '/admin/collections/cateringRequests?where[status][equals]=new',
      icon: <ClipboardList />,
    },
    upcoming && {
      label: 'Upcoming events',
      value: upcoming.totalDocs,
      hint: next ? `Next: ${next.title} · ${eventDate(next.startsAt, null, 'en-GB').date}` : 'None published: add a date',
      href: '/admin/collections/events',
      icon: <CalendarDays />,
    },
    media && { label: 'Photos in the library', value: media.totalDocs, hint: 'Media', href: '/admin/collections/media', icon: <Images /> },
  ];
  const stats = statList.filter((s): s is Stat => s !== null);

  const actionList: (Action | false)[] = [
    editor && { label: 'Edit events', href: '/admin/collections/events', icon: <CalendarDays /> },
    editor && { label: 'Happy Hour', href: '/admin/globals/HappyHour', icon: <Wine /> },
    editor && { label: 'Business settings', href: '/admin/globals/BusinessSettings', icon: <Settings /> },
    { label: 'View the website', href: '/fr', icon: <ExternalLink />, external: true },
  ];
  const actions = actionList.filter((a): a is Action => a !== false);

  return (
    <section className="gg-dash">
      <div className="gg-dash__hero">
        <div className="gg-dash__hero-text">
          <p className="gg-dash__eyebrow">
            <Clock /> {today}
          </p>
          <h1 className="gg-dash__title">
            {greeting(local.hour)}
            {firstName && <em>, {firstName}.</em>}
          </h1>
          <p className="gg-dash__lead">Everything the website shows is edited here, in French, English, German and Portuguese.</p>
        </div>
        <Image src="/brand/mark.png" alt="" width={180} height={240} className="gg-dash__hero-mark" />
      </div>

      {stats.length > 0 && (
        <div className="gg-dash__stats">
          {stats.map((s) => (
            <a key={s.label} href={s.href} className="gg-dash__stat">
              <span className="gg-dash__stat-icon">{s.icon}</span>
              <span className="gg-dash__stat-value">{s.value}</span>
              <span className="gg-dash__stat-label">{s.label}</span>
              <span className="gg-dash__stat-hint">{s.hint}</span>
            </a>
          ))}
        </div>
      )}

      <div className="gg-dash__actions">
        {actions.map((a) => (
          <a key={a.label} href={a.href} className="gg-dash__action" {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {a.icon}
            {a.label}
          </a>
        ))}
      </div>
    </section>
  );
}
