import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The 56 px bar of every staff screen (05 §5): a back link, the title, and an optional action on the right. */
export function TopBar({ title, back, action }: { title: string; back?: { href: string; label: string }; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bone/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {back ? (
        <Link href={back.href} aria-label={back.label} className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-champagne">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      <h1 className="min-w-0 flex-1 truncate font-serif text-2xl">{title}</h1>
      {action && <div className="shrink-0 pr-2">{action}</div>}
    </header>
  );
}
