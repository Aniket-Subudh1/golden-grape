import type { Role } from '@/lib/access';
import type { ModuleName } from '@/modules/settings/globals';

// Who may open which phone screen (05 §5). Read by the pages (session.ts) and by proxy.ts, which answers a real 404
// before rendering: with Cache Components a page's own notFound() comes after its first await, once the response has
// started (HTTP 200 + noindex). Plain data, no server imports: the proxy loads it.
export const SCREENS = {
  home: { href: '/staff', roles: [] },
  scan: { href: '/staff/scan', roles: ['stock', 'sales', 'manager'] },
  sale: { href: '/staff/sale', roles: ['sales', 'manager'] },
  orders: { href: '/staff/orders', roles: ['sales', 'manager'] },
  receive: { href: '/staff/receive', roles: ['stock', 'manager'], module: 'purchasing' },
  count: { href: '/staff/count', roles: ['stock', 'manager'] },
  customers: { href: '/staff/customers', roles: ['sales', 'manager'] },
  stock: { href: '/staff/stock', roles: ['stock', 'manager'] },
  reorder: { href: '/staff/reorder', roles: ['stock', 'manager'], module: 'purchasing' },
} as const satisfies Record<string, { href: string; roles: Role[]; module?: ModuleName }>;
export type Screen = keyof typeof SCREENS;

/** The screen a path belongs to (the longest matching prefix), or null for the sign-in page and unknown paths. */
export function screenOf(pathname: string): Screen | null {
  let best: Screen | null = null;
  for (const [screen, { href }] of Object.entries(SCREENS) as [Screen, { href: string }][]) {
    const match = href === '/staff' ? pathname === '/staff' : pathname === href || pathname.startsWith(`${href}/`);
    if (match && (!best || href.length > SCREENS[best].href.length)) best = screen;
  }
  return best;
}
