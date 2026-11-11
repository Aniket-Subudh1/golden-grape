import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };

/**
 * Card grid: `hairline` draws 1 px lines between cards (snack, events), as a ring on each card, so a last row with
 * fewer cards leaves the page's own background instead of a grey block; otherwise spaced cards (shop).
 */
export function MediaGrid({ cols, hairline, className, children }: { cols: 2 | 3 | 4; hairline?: boolean; className?: string; children: ReactNode }) {
  return <div className={cn('grid grid-cols-1', COLS[cols], hairline ? 'gap-px *:ring-1 *:ring-border' : 'gap-6 md:gap-8', className)}>{children}</div>;
}
