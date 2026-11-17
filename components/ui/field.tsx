'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldError } from './action-form';

const control =
  'w-full border-b border-border bg-transparent outline-none transition placeholder:text-ink/30 focus:border-gold-deep aria-invalid:border-red-700';
// `box`: the back office's sign-in look (bordered, white, label in plain text), used by the staff sign-in.
const boxed =
  'w-full rounded-md border border-ink/15 bg-white px-3 shadow-[0_1px_2px_rgb(26_28_32/0.04)] outline-none transition placeholder:text-ink/30 focus:border-gold-deep focus:ring-2 focus:ring-gold/25 aria-invalid:border-red-700';

// `md`: compact forms (events dialog, cart). `lg`: page forms (contact, catering).
const SIZES = {
  md: { label: 'mb-1.5', control: 'text-sm', height: 'h-10' },
  lg: { label: 'mb-2', control: 'text-base', height: 'h-11' },
};

/**
 * `error`: a message decided in the browser (the checkout's missing fields); otherwise the ActionForm error for `name`.
 * `hint`: how to fill it in, between the label and the field (the delivery address, QA 12 Nov GG-16).
 */
type Common = {
  label: string;
  name: string;
  size?: 'md' | 'lg';
  look?: 'line' | 'box';
  error?: string | false | null;
  hint?: string;
  trailing?: ReactNode;
};
type Props =
  | (Common & { as?: 'input' } & Omit<ComponentProps<'input'>, 'size'>)
  | (Common & { as: 'textarea' } & ComponentProps<'textarea'>)
  | (Common & { as: 'select' } & Omit<ComponentProps<'select'>, 'size'>);

/**
 * Underline field (or `look="box"`) with its label and the ActionForm error for `name`. `trailing`: a button inside
 * the input's right edge (show password).
 */
export function Field({
  label,
  name,
  className,
  as = 'input',
  size = 'md',
  look = 'line',
  error: own,
  hint,
  trailing,
  ...props
}: Props) {
  const sz = SIZES[size];
  const base = look === 'box' ? boxed : control;
  const fromAction = useFieldError(name);
  const error = own || fromAction;
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined;
  const shared = { name, id: name, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className={cn(look === 'box' ? 'text-ink/80 block text-sm font-medium' : 'eyebrow text-ink/60 block', sz.label)}
      >
        {label}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="text-ink/55 mb-1.5 text-xs">
          {hint}
        </p>
      )}
      {as === 'textarea' ? (
        <textarea
          {...shared}
          {...(props as ComponentProps<'textarea'>)}
          className={cn(base, sz.control, 'min-h-28 resize-none py-2')}
        />
      ) : as === 'select' ? (
        <select {...shared} {...(props as ComponentProps<'select'>)} className={cn(base, sz.control, sz.height)} />
      ) : trailing ? (
        <div className="relative">
          <input
            {...shared}
            {...(props as ComponentProps<'input'>)}
            className={cn(base, sz.control, sz.height, 'pr-11')}
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</span>
        </div>
      ) : (
        <input {...shared} {...(props as ComponentProps<'input'>)} className={cn(base, sz.control, sz.height)} />
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
