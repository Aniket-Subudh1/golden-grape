'use client';

import { Home } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';
import { ICONS } from './icons';
import { LanguageMenu } from './language';
import { SignOut } from './sign-out';

export type NavItem = { screen: string; href: string; label: string };

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/staff' ? pathname === '/staff' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The staff app's navigation from tablets up (owner decision, 17 Nov): an icon rail on tablets (768–1023 px), the back
 * office's sidebar on laptops (lockup, every screen the role opens, the person and sign-out). Phones use `TabBar`.
 */
export function StaffNav({
  items,
  user,
  t,
}: {
  items: NavItem[];
  user: { name: string; email: string; locale: Locale };
  t: { app: string; menu: string; signOut: string; language: string };
}) {
  const active = useActive();
  return (
    <aside className="border-border sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col border-r bg-[#e1e7f0] md:flex lg:w-[248px]">
      <Link href="/staff" className="flex h-20 items-center justify-center gap-3 px-3 lg:justify-start lg:px-6">
        <Image src="/brand/mark.png" alt="Golden Grape" width={37} height={40} className="h-10 w-auto" />
        <span className="hidden leading-tight lg:grid">
          <span className="text-[17px] font-semibold tracking-[-0.015em]">
            Golden <b className="text-gold-deep font-bold">Grape</b>
          </span>
          <span className="text-ink/60 text-xs">{t.app}</span>
        </span>
      </Link>
      <nav aria-label={t.menu} className="flex-1 overflow-y-auto px-2.5 py-2 lg:px-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.screen as keyof typeof ICONS] ?? Home;
            const on = active(item.href);
            return (
              <li key={item.screen}>
                <Link
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-[10px] px-0.5 py-2.5 text-[10.5px] font-medium transition lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm',
                    on
                      ? 'text-ink bg-white shadow-[0_1px_2px_rgb(26_28_32/0.06)]'
                      : 'text-ink/65 hover:text-ink hover:bg-[#d2dae6]',
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0 lg:h-[18px] lg:w-[18px]', on && 'text-gold-deep')} />
                  <span className="max-w-full text-center leading-tight break-words lg:truncate lg:text-left">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-2.5 pb-3 lg:px-3">
        <LanguageMenu current={user.locale} label={t.language} account place="up" />
      </div>
      <div className="border-border flex flex-col items-center gap-2 border-t p-3 lg:flex-row lg:gap-3 lg:px-4">
        <span
          className="bg-gold-deep grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          aria-hidden
        >
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden min-w-0 flex-1 leading-tight lg:block">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="text-ink/55 block truncate text-xs">{user.email}</span>
        </span>
        <SignOut label={t.signOut} />
      </div>
    </aside>
  );
}

/** The phone's bottom tab bar (05 §5): at most five tabs, already filtered by role and module on the server. */
export function TabBar({ tabs }: { tabs: NavItem[] }) {
  const active = useActive();
  return (
    <nav className="border-border fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.screen as keyof typeof ICONS] ?? Home;
          const on = active(tab.href);
          return (
            <li key={tab.screen} className="flex-1">
              <Link
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                  on ? 'text-gold-deep' : 'text-ink/55',
                )}
              >
                <span className={cn('grid h-8 w-12 place-items-center rounded-full transition', on && 'bg-champagne')}>
                  <Icon className="h-5 w-5" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
