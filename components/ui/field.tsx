'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { useFieldError } from './action-form';

const control =
  'w-full border-b border-border bg-transparent outline-none transition placeholder:text-ink/30 focus:border-gold-deep';

// `md`: compact forms (events dialog, cart). `lg`: page forms (contact, catering).
const SIZES = {
  md: { label: 'mb-1.5', control: 'text-sm', height: 'h-10' },
  lg: { label: 'mb-2', control: 'text-base', height: 'h-11' },
};

type Common = { label: string; name: string; size?: 'md' | 'lg' };
type Props =
  | (Common & { as?: 'input' } & ComponentProps<'input'>)
  | (Common & { as: 'textarea' } & ComponentProps<'textarea'>)
  | (Common & { as: 'select' } & ComponentProps<'select'>);

/** Underline field with its label and the ActionForm error for `name`. */
export function Field({ label, name, className, as = 'input', size = 'md', ...props }: Props) {
  const sz = SIZES[size];
  const error = useFieldError(name);
  const describedBy = error ? `${name}-error` : undefined;
  const shared = { name, id: name, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  return (
    <div className={className}>
      <label htmlFor={name} className={cn('eyebrow block text-ink/60', sz.label)}>
        {label}
      </label>
      {as === 'textarea' ? (
        <textarea {...shared} {...(props as ComponentProps<'textarea'>)} className={cn(control, sz.control, 'min-h-28 resize-none py-2')} />
      ) : as === 'select' ? (
        <select {...shared} {...(props as ComponentProps<'select'>)} className={cn(control, sz.control, sz.height)} />
      ) : (
        <input {...shared} {...(props as ComponentProps<'input'>)} className={cn(control, sz.control, sz.height)} />
      )}
      {error && (
        <p id={describedBy} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
