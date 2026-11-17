'use client';

import { ClipboardList, Home, PackageCheck, ScanBarcode, ShoppingBag, Tally5, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ICONS = { home: Home, scan: ScanBarcode, sale: ShoppingBag, orders: ClipboardList, receive: PackageCheck, count: Tally5, customers: Users } as const;

type Tab = { screen: string; href: string; label: string };

/** The bottom tab bar (05 §5): at most five tabs, already filtered by role and module on the server. */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bone/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.screen as keyof typeof ICONS] ?? Home;
          const active = tab.href === '/staff' ? pathname === '/staff' : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.screen} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[10px] tracking-[0.12em] uppercase transition', active ? 'text-gold-deep' : 'text-ink/55')}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
