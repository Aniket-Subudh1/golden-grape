'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Account sections as chips; the current one filled. */
export function AccountNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-[11px] tracking-[0.22em] whitespace-nowrap uppercase transition',
              active ? 'border-ink bg-ink text-bone' : 'border-border text-ink/70 hover:border-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
