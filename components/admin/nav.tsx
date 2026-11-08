import type { I18nClient } from '@payloadcms/translations';
import type { Payload, TypedUser, VisibleEntities } from 'payload';
import { hasRole, type Role } from '@/lib/access';
import { today } from '@/lib/time';
import { ORDER_TABS, orderTabQuery } from '@/modules/sales/admin/order-tabs';
import { getAlerts } from './alerts';
import { type NavGroup, NavClient } from './nav-client';
import { adminText } from './text';

type Key = keyof ReturnType<typeof adminText>['nav'];

// The admin sidebar (Payload `admin.components.Nav`), laid out like the CUTM LMS sidebar: brand block, grouped
// icon items in everyday words, then account links. Only what the user's role may open is listed.
// An item opens a collection or global (`slug`, listed when the role may see it) or one of our admin pages (`path`, listed
// for `roles`).
const GROUPS: { label: Key; items: { label: Key; slug: string; global?: boolean; path?: string; roles?: Role[]; icon: string; query?: string }[] }[] = [
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
      { label: 'importExport', slug: 'importExport', path: '/admin/import-export', roles: ['manager', 'stock'], icon: 'importExport' },
    ],
  },
  {
    label: 'sales',
    items: [
      // Orders open on their "To do" tab; reservations on today and what is coming (the filter can be cleared).
      { label: 'orders', slug: 'orders', icon: 'orders', query: orderTabQuery(ORDER_TABS[0]) },
      { label: 'reservations', slug: 'reservations', icon: 'reservations', query: '?where[slotAt][greater_than_equal]={today}&sort=slotAt' },
      { label: 'eventBookings', slug: 'eventBookings', icon: 'bookings' },
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
      { label: 'deliveryZones', slug: 'deliveryZones', icon: 'zones' },
      { label: 'slotRules', slug: 'slotRules', icon: 'slots' },
      { label: 'topMenu', slug: 'Header', global: true, icon: 'header' },
      { label: 'footer', slug: 'Footer', global: true, icon: 'footer' },
      { label: 'team', slug: 'users', icon: 'users' },
      { label: 'activity', slug: 'auditLogs', icon: 'audit' },
    ],
  },
];

type Props = { visibleEntities: VisibleEntities; i18n: I18nClient; payload: Payload; user?: TypedUser | null };

export default async function AdminNav({ visibleEntities, i18n, payload, user }: Props) {
  const t = adminText(i18n.language);
  const groups: NavGroup[] = GROUPS.map((g) => ({
    id: g.label,
    label: t.nav[g.label],
    items: g.items
      .filter((i) => (i.path ? hasRole(user, i.roles ?? []) : ((i.global ? visibleEntities.globals : visibleEntities.collections) as string[]).includes(i.slug)))
      .map((i) => ({ label: t.nav[i.label], icon: i.icon, slug: i.slug, href: i.path ?? `/admin/${i.global ? 'globals' : 'collections'}/${i.slug}${(i.query ?? '').replace('{today}', today())}` })),
  })).filter((g) => g.items.length > 0);
  // What waits beside each item (GG-002); the client keeps it fresh while the page stays open (alerts-client.tsx).
  const alerts = await getAlerts(payload, user ?? null);
  return <NavClient groups={groups} alerts={alerts} text={{ ...t.nav, brandSub: t.brandSub }} />;
}
