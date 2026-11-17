import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A home figure, in the back office's metric tile (05 §3.3): uppercase label, the figure, one line of context, an icon
 * box, and a gold left bar when something waits. It opens the screen the figure comes from.
 */
export function Tile({
  href,
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  href: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'gg-card group relative flex min-h-32 flex-col overflow-hidden p-4 transition hover:-translate-y-px hover:shadow-md md:p-5',
        tone === 'warning' && 'before:bg-gold before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-ink/55 text-[11px] font-semibold tracking-[0.06em] uppercase">{label}</span>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px]',
            tone === 'warning' ? 'bg-champagne text-gold-deep' : 'text-ink/60 bg-[#e7ecf3]',
          )}
        >
          {icon}
        </span>
      </span>
      <span className="mt-auto pt-3 text-[32px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      {hint && (
        <span className="text-ink/55 mt-2 flex items-center justify-between gap-2 text-xs">
          {hint}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
        </span>
      )}
    </Link>
  );
}
