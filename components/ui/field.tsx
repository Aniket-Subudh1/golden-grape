'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { useFieldError } from './action-form';

const control =
  'w-full border-b border-border bg-transparent text-sm outline-none transition placeholder:text-ink/30 focus:border-gold-deep';

type Common = { label: string; name: string };
type Props =
  | (Common & { as?: 'input' } & ComponentProps<'input'>)
  | (Common & { as: 'textarea' } & ComponentProps<'textarea'>)
  | (Common & { as: 'select' } & ComponentProps<'select'>);

/** Underline field with its label and the ActionForm error for `name`. */
export function Field({ label, name, className, as = 'input', ...props }: Props) {
  const error = useFieldError(name);
  const describedBy = error ? `${name}-error` : undefined;
  const shared = { name, id: name, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  return (
    <div className={className}>
      <label htmlFor={name} className="eyebrow mb-1.5 block text-ink/60">
        {label}
      </label>
      {as === 'textarea' ? (
        <textarea {...shared} {...(props as ComponentProps<'textarea'>)} className={cn(control, 'min-h-28 py-2')} />
      ) : as === 'select' ? (
        <select {...shared} {...(props as ComponentProps<'select'>)} className={cn(control, 'h-10')} />
      ) : (
        <input {...shared} {...(props as ComponentProps<'input'>)} className={cn(control, 'h-10')} />
      )}
      {error && (
        <p id={describedBy} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
