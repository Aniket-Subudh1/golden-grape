import type { VisibleEntities } from 'payload';
import { type NavGroup, NavClient } from './nav-client';

// The admin sidebar (Payload `admin.components.Nav`), laid out like the CUTM LMS sidebar: brand block, grouped
// icon items, then account links. Only what the user's role may open is listed (Payload's visibleEntities).
const GROUPS: { label: string; items: { label: string; slug: string; global?: boolean; icon: string }[] }[] = [
  {
    label: 'Website',
    items: [
      { label: 'Pages', slug: 'pages', icon: 'pages' },
      { label: 'Events', slug: 'events', icon: 'events' },
      { label: 'Catering packages', slug: 'cateringPackages', icon: 'catering' },
      { label: 'Happy Hour', slug: 'HappyHour', global: true, icon: 'happy' },
      { label: 'Media', slug: 'media', icon: 'media' },
      { label: 'Legal pages', slug: 'legal', icon: 'legal' },
    ],
  },
  { label: 'Requests', items: [{ label: 'Catering requests', slug: 'cateringRequests', icon: 'requests' }] },
  {
    label: 'Settings',
    items: [
      { label: 'Business settings', slug: 'BusinessSettings', global: true, icon: 'settings' },
      { label: 'Header menu', slug: 'Header', global: true, icon: 'header' },
      { label: 'Footer', slug: 'Footer', global: true, icon: 'footer' },
      { label: 'Users', slug: 'users', icon: 'users' },
      { label: 'Audit log', slug: 'auditLogs', icon: 'audit' },
    ],
  },
];

export default function AdminNav({ visibleEntities }: { visibleEntities: VisibleEntities }) {
  const groups: NavGroup[] = GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => ((i.global ? visibleEntities.globals : visibleEntities.collections) as string[]).includes(i.slug))
      .map((i) => ({ label: i.label, icon: i.icon, href: `/admin/${i.global ? 'globals' : 'collections'}/${i.slug}` })),
  })).filter((g) => g.items.length > 0);
  return <NavClient groups={groups} />;
}
