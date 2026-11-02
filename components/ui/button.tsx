import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// Every pill/CTA class string of the prototype lives here (05 §3.2). Callers add layout classes only.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.3em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        solid: 'rounded-full bg-ink text-bone hover:bg-gold-deep',
        outline: 'rounded-full border border-ink text-ink hover:bg-ink hover:text-bone',
        gold: 'rounded-full border border-gold-deep text-gold-deep hover:bg-gold-deep hover:text-bone',
        // Hero, Store and Happy Hour CTA: square, translucent gold over a dark image.
        goldGlass:
          'group border border-gold/70 bg-gold/10 text-bone backdrop-blur-sm transition-all hover:bg-gold hover:text-ink',
        ghost: 'rounded-full hover:bg-ink hover:text-bone',
        chip: 'rounded-full border tracking-[0.22em]',
        icon: 'grid place-items-center rounded-full border border-border hover:border-gold-deep hover:text-gold-deep',
      },
      size: {
        sm: 'h-9 px-4',
        md: 'h-11 px-6',
        lg: 'h-12 px-8',
      },
      active: { true: '', false: '' },
    },
    compoundVariants: [
      { variant: 'goldGlass', size: 'md', className: 'h-auto px-7 py-3.5' },
      { variant: 'goldGlass', size: 'lg', className: 'h-auto px-8 py-4' },
      { variant: ['ghost', 'icon'], size: 'sm', className: 'w-9 px-0' },
      { variant: ['ghost', 'icon'], size: 'md', className: 'h-10 w-10 px-0' },
      { variant: 'chip', active: true, className: 'border-ink bg-ink text-bone' },
      { variant: 'chip', active: false, className: 'border-border bg-transparent text-ink/70 hover:border-ink' },
    ],
    defaultVariants: { variant: 'solid', size: 'md', active: false },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, active, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size, active }), className)} {...props} />;
}
