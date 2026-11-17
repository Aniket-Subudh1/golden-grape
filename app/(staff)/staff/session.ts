import { notFound, redirect } from 'next/navigation';
import { hasRole, type Role } from '@/lib/access';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { ModuleName } from '@/modules/settings/globals';
import { currentStaff, isModuleOn } from '@/modules/settings/service';

// Who may open which phone screen (05 §5): the tab bar shows only these, and the pages themselves answer 404 to anyone
// else, so a URL typed by hand opens nothing more than the tab bar offers (AC-M3.1-07).
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

/** The order of the bottom tab bar: the first five a user may open (05 §5, at most 5 tabs). */
const TABS: Screen[] = ['home', 'scan', 'sale', 'orders', 'receive', 'count', 'customers'];

type ScreenRule = { roles: readonly Role[]; module?: ModuleName };

export async function canOpen(user: { collection?: unknown; roles?: unknown }, screen: Screen) {
  const rule: ScreenRule = SCREENS[screen];
  return hasRole(user, rule.roles) && (!rule.module || (await isModuleOn(rule.module)));
}

/**
 * Every staff page starts here: no session → sign-in (back to `path` afterwards); a role or a switched-off module that
 * does not allow the screen → 404. Returns the user and the screens' texts in the user's language.
 */
export async function requireStaff(screen: Screen, path: string = SCREENS[screen].href) {
  const user = await currentStaff();
  if (!user) redirect(`/staff/login?next=${encodeURIComponent(path)}`);
  if (!(await canOpen(user, screen))) notFound();
  const locale = (user.locale ?? 'fr') as Locale;
  const t = await getDictionary(locale);
  return { user, locale, t: t.staff, dict: t };
}

/** The tabs this user sees, in order (at most five). */
export async function tabsFor(user: { collection?: unknown; roles?: unknown }) {
  const allowed: Screen[] = [];
  for (const screen of TABS) if (await canOpen(user, screen)) allowed.push(screen);
  return allowed.slice(0, 5);
}
