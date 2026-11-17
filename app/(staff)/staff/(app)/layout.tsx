import { connection } from 'next/server';
import { StaffNav, TabBar } from '@/components/staff/nav';
import { getDictionary, type Locale } from '@/lib/i18n';
import { currentStaff } from '@/modules/settings/service';
import { type Screen, SCREENS } from '../screens';
import { navFor, tabsFor } from '../session';

export const instant = false;

/**
 * The staff app's frame (owner decision, 17 Nov): phones get the bottom tab bar (at most five tabs), tablets an icon
 * rail and laptops the back office's sidebar, both listing every screen the role and the modules allow. Each page
 * checks access itself (session.ts).
 */
export default async function StaffAppLayout({ children }: LayoutProps<'/staff'>) {
  await connection();
  const user = await currentStaff();
  if (!user) return <>{children}</>;
  const t = (await getDictionary((user.locale ?? 'fr') as Locale)).staff;
  const label = (screen: Screen) => (screen in t.tabs ? t.tabs[screen as keyof typeof t.tabs] : screen);
  const item = (screen: Screen) => ({ screen, href: SCREENS[screen].href, label: label(screen) });
  const [tabs, nav] = await Promise.all([tabsFor(user), navFor(user)]);
  return (
    <div className="min-h-dvh md:flex">
      <StaffNav
        items={nav.map(item)}
        user={{ name: user.name, email: user.email }}
        t={{ app: t.login.app, menu: t.menu, signOut: t.signOut }}
      />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <TabBar tabs={tabs.map(item)} />
    </div>
  );
}
