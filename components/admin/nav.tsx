import type { I18nClient } from '@payloadcms/translations';
import type { VisibleEntities } from 'payload';
import { type NavGroup, NavClient } from './nav-client';
import { adminText } from './text';

type Key = keyof ReturnType<typeof adminText>['nav'];

// The admin sidebar (Payload `admin.components.Nav`), laid out like the CUTM LMS sidebar: brand block, grouped
// icon items in everyday words, then account links. Only what the user's role may open is listed.
const GROUPS: { label: Key; items: { label: Key; slug: string; global?: boolean; icon: string; query?: string }[] }[] = [
  {
    label: 'website',
    items: [
      { label: 'homePage', slug: 'HomePage', global: true, icon: 'home' },
      { label: 'events', slug: 'events', icon: 'events' },
      { label: 'happyHour', slug: 'HappyHour', global: true, icon: 'happy' },
      { label: 'catering', slug: 'cateringPackages', icon: 'catering' },
      { label: 'photos', slug: 'media', icon: 'media' },
      { label: 'house', slug: 'pages', icon: 'pages' },
      { label: 'legal', slug: 'legal', icon: 'legal' },
    ],
  },
  {
    label: 'catalogue',
    items: [
      { label: 'products', slug: 'products', icon: 'products' },
      { label: 'categories', slug: 'categories', icon: 'categories' },
      { label: 'producers', slug: 'brands', icon: 'producers' },
      // Payload's own list, opened with the low-stock filter (staff can clear it to see all levels).
      { label: 'lowStock', slug: 'stockLevels', icon: 'lowStock', query: '?where[lowStock][equals]=true' },
      { label: 'stockCounts', slug: 'stockCounts', icon: 'counts' },
      { label: 'stockMovements', slug: 'stockMovements', icon: 'movements' },
    ],
  },
  {
    label: 'requests',
    items: [
      { label: 'customers', slug: 'customers', icon: 'users' },
      { label: 'customerGroups', slug: 'customerGroups', icon: 'groups' },
      { label: 'cateringRequests', slug: 'cateringRequests', icon: 'requests' },
    ],
  },
  {
    label: 'settings',
    items: [
      { label: 'shop', slug: 'BusinessSettings', global: true, icon: 'settings' },
      { label: 'topMenu', slug: 'Header', global: true, icon: 'header' },
      { label: 'footer', slug: 'Footer', global: true, icon: 'footer' },
      { label: 'team', slug: 'users', icon: 'users' },
      { label: 'activity', slug: 'auditLogs', icon: 'audit' },
    ],
  },
];

export default function AdminNav({ visibleEntities, i18n }: { visibleEntities: VisibleEntities; i18n: I18nClient }) {
  const t = adminText(i18n.language);
  const groups: NavGroup[] = GROUPS.map((g) => ({
    label: t.nav[g.label],
    items: g.items
      .filter((i) => ((i.global ? visibleEntities.globals : visibleEntities.collections) as string[]).includes(i.slug))
      .map((i) => ({ label: t.nav[i.label], icon: i.icon, href: `/admin/${i.global ? 'globals' : 'collections'}/${i.slug}${i.query ?? ''}` })),
  })).filter((g) => g.items.length > 0);
  return <NavClient groups={groups} text={{ ...t.nav, brandSub: t.brandSub }} />;
}
