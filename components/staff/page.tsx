import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
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
      {/* Phones: the dark Golden Grape app bar (logo or back, the gold wordmark above the screen's title, an action).
          From tablets up: the back office's page head (gold title bar, subtitle), the sidebar carrying the brand. */}
      <header className="gg-appbar md:text-ink sticky top-0 z-30 bg-[#16181c] pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgb(201_162_74/0.35)] md:static md:bg-transparent md:pt-0 md:shadow-none">
        <div
          className={cn(
            'mx-auto flex h-16 w-full items-center gap-2 px-3 md:h-auto md:gap-3 md:px-8 md:pt-8 md:pb-2',
            WIDTH[width],
          )}
        >
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              // Back to Home is the sidebar's job from tablets up.
              data-home={back.href === '/staff' || undefined}
              className="md:border-border md:hover:bg-champagne grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 md:h-9 md:w-9 md:rounded-lg md:border md:bg-white data-home:md:hidden"
            >
              <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
            </Link>
          ) : (
            <Image
              src="/brand/mark.png"
              alt=""
              width={32}
              height={34}
              className="h-9 w-auto shrink-0 md:hidden"
              priority
            />
          )}
          <div className="min-w-0 flex-1 md:pl-0">
            <p className="text-gold flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.2em] uppercase md:hidden">
              Golden Grape
            </p>
            <h1 className="mt-1 flex items-center gap-3 truncate text-[17px] leading-tight md:mt-0 md:text-[26px]">
              <span className="bg-gold hidden h-6 w-[3px] shrink-0 rounded-full md:block" aria-hidden />
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && <p className="text-ink/60 mt-1 hidden text-sm md:block md:pl-[15px]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
          {back && !action && (
            <Image
              src="/brand/mark.png"
              alt=""
              width={26}
              height={28}
              className="h-7 w-auto shrink-0 opacity-90 md:hidden"
            />
          )}
        </div>
      </header>
      <main className={cn('mx-auto w-full px-4 pt-4 pb-6 md:px-8 md:pt-4 md:pb-12', WIDTH[width], className)}>
        {children}
      </main>
    </>
  );
}
