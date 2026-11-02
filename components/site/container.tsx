import type { ComponentProps, ElementType } from 'react';
import { cn } from '@/lib/cn';

type Props = ComponentProps<'div'> & { size?: 'md' | 'lg'; as?: ElementType };

/** Centred page column: 1400 px (`lg`, default) or 1200 px (`md`). */
export function Container({ size = 'lg', as: Tag = 'div', className, ...props }: Props) {
  return (
    <Tag
      className={cn('mx-auto px-5 md:px-10', size === 'lg' ? 'max-w-[1400px]' : 'max-w-[1200px]', className)}
      {...props}
    />
  );
}
