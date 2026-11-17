import { connection } from 'next/server';
import { TabBar } from '@/components/staff/tab-bar';
import { getDictionary, type Locale } from '@/lib/i18n';
import { currentStaff } from '@/modules/settings/service';
import { SCREENS, tabsFor } from '../session';

export const instant = false;

/** Content above a bottom tab bar filtered by role and module. Each page checks access itself (session.ts). */
export default async function StaffAppLayout({ children }: LayoutProps<'/staff'>) {
  await connection();
  const user = await currentStaff();
  const t = user ? (await getDictionary((user.locale ?? 'fr') as Locale)).staff : null;
  const tabs = user && t ? (await tabsFor(user)).map((screen) => ({ screen, href: SCREENS[screen].href, label: t.tabs[screen as keyof typeof t.tabs] })) : [];
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}
      {tabs.length > 0 && <TabBar tabs={tabs} />}
    </div>
  );
}
