import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** A home tile (05 §5): what it counts, the figure, one line of context; opens the screen the figure comes from. */
export function Tile({ href, label, value, hint, tone = 'neutral' }: { href: string; label: string; value: number | string; hint?: string; tone?: 'neutral' | 'warning' }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-28 flex-col justify-between rounded-xl border bg-white/60 p-4 transition active:scale-[0.99]',
        tone === 'warning' ? 'border-amber-300 bg-amber-50/70' : 'border-border',
      )}
    >
      <span className="eyebrow flex items-center justify-between text-ink/60">
        {label}
        <ChevronRight className="h-4 w-4" />
      </span>
      <span className="mt-2 font-serif text-4xl leading-none tabular-nums">{value}</span>
      {hint && <span className="mt-1 text-xs text-ink/55">{hint}</span>}
    </Link>
  );
}
