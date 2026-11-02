import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const COLS = { 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };

/** Card grid: `hairline` draws 1 px borders between cards (snack, events); otherwise spaced cards (shop). */
export function MediaGrid({ cols, hairline, children }: { cols: 3 | 4; hairline?: boolean; children: ReactNode }) {
  return <div className={cn('grid grid-cols-1', COLS[cols], hairline ? 'gap-px bg-border' : 'gap-6 md:gap-8')}>{children}</div>;
}
