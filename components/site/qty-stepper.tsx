'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** null = no limit (made-to-order items). */
  max?: number | null;
  /** `sm`: cart lines. `md`: product page. `lg`: counter cards (full width). */
  size?: 'sm' | 'md' | 'lg';
  labels: { minus: string; plus: string };
};

/** − value + in a rounded bordered row (05 §3.2): cart lines, product page, counter cards. */
export function QtyStepper({ value, onChange, min = 0, max = null, size = 'md', labels }: Props) {
  const button = cn(
    'grid place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30',
    size === 'sm' ? 'h-7 w-7 hover:text-gold-deep' : 'h-9 w-9 hover:bg-ink hover:text-bone',
  );
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border',
        size === 'sm' && 'border-border',
        size === 'md' && 'h-11 border-ink px-1',
        size === 'lg' && 'animate-fade-in flex h-11 w-full justify-between border-ink px-2',
      )}
    >
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={labels.minus}>
        <Minus className={icon} />
      </button>
      <span className={cn('text-center tabular-nums', size === 'sm' ? 'w-6 text-sm' : 'w-10 font-serif text-xl')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={max !== null && value >= max} aria-label={labels.plus}>
        <Plus className={icon} />
      </button>
    </div>
  );
}
