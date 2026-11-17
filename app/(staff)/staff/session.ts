import { notFound, redirect } from 'next/navigation';
import { hasRole, type Role } from '@/lib/access';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { ModuleName } from '@/modules/settings/globals';
import { currentStaff, isModuleOn } from '@/modules/settings/service';
import { SCREENS, type Screen } from './screens';

/** The order of the bottom tab bar: the first five a user may open (05 §5, at most 5 tabs). */
const TABS: Screen[] = ['home', 'scan', 'sale', 'orders', 'receive', 'count', 'customers', 'attendance'];
/** The order of the sidebar: everything a role opens, the reorder list included. */
const NAV: Screen[] = ['home', 'scan', 'sale', 'orders', 'customers', 'receive', 'count', 'reorder', 'attendance', 'attendanceQr'];

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

/** The phone's bottom tab bar: the first five of `TABS` this user may open (05 §5). */
export async function tabsFor(user: { collection?: unknown; roles?: unknown }) {
  const allowed: Screen[] = [];
  for (const screen of TABS) if (await canOpen(user, screen)) allowed.push(screen);
  return allowed.slice(0, 5);
}

/** The sidebar and rail (tablets, laptops): every screen of `NAV` this user may open. */
export async function navFor(user: { collection?: unknown; roles?: unknown }) {
  const allowed: Screen[] = [];
  for (const screen of NAV) if (await canOpen(user, screen)) allowed.push(screen);
  return allowed;
}
