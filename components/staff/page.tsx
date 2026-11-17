import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const WIDTH = { narrow: 'max-w-2xl', wide: 'max-w-6xl' } as const;

/**
 * Every staff screen's frame: on phones the 56 px sticky bar (back link, title, an action); from tablets up the back
 * office's page head (gold title bar, larger title, optional subtitle) above content of a readable width. `className`
 * lays out the content (grids for the wide screens).
 */
export function StaffPage({
  title,
  subtitle,
  back,
  action,
  width = 'narrow',
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-border sticky top-0 z-30 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur md:static md:border-0 md:bg-transparent md:pt-0 md:backdrop-blur-none">
        <div
          className={cn(
            'mx-auto flex h-14 w-full items-center gap-2 px-2 md:h-auto md:gap-3 md:px-8 md:pt-8 md:pb-2',
            WIDTH[width],
          )}
        >
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              // Back to Home is the sidebar's job from tablets up.
              data-home={back.href === '/staff' || undefined}
              className="hover:bg-champagne md:border-border grid h-11 w-11 shrink-0 place-items-center rounded-full transition md:h-9 md:w-9 md:rounded-lg md:border md:bg-white data-home:md:hidden"
            >
              <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
            </Link>
          ) : (
            <span className="w-2 shrink-0 md:hidden" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-3 truncate text-lg md:text-[26px] md:leading-tight">
              <span className="bg-gold hidden h-6 w-[3px] shrink-0 rounded-full md:block" aria-hidden />
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && <p className="text-ink/60 mt-1 hidden text-sm md:block md:pl-[15px]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 pr-2 md:pr-0">{action}</div>}
        </div>
      </header>
      <main className={cn('mx-auto w-full px-4 pt-4 pb-6 md:px-8 md:pt-4 md:pb-12', WIDTH[width], className)}>
        {children}
      </main>
    </>
  );
}
