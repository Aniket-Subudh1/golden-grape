import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './container';

type Props = { eyebrow?: string | null; title: [string, string?]; subtitle?: string | null; children?: ReactNode; className?: string; /** A listing page: the content, not the header, is the priority (APPLUX report 4, §1). */ compact?: boolean };

/** Page header of the inner pages: eyebrow, serif title with a gold italic second half, subtitle. */
export function PageHero({ eyebrow, title: [a, b], subtitle, children, className, compact }: Props) {
  return (
    <section className={cn('relative overflow-hidden', compact ? 'pt-28 pb-6 md:pt-32 md:pb-8' : 'pt-36 pb-14 md:pt-48', className)}>
      <div
        className="bg-azulejo pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)] md:block"
        aria-hidden="true"
      />
      <Container className="relative px-6">
        {eyebrow && <p className={cn('eyebrow text-gold-deep', compact ? 'mb-2' : 'mb-6')}>{eyebrow}</p>}
        <h1 className={cn('max-w-4xl font-serif tracking-tight', compact ? 'text-3xl leading-tight md:text-5xl' : 'text-5xl leading-[0.95] md:text-7xl')}>
          {a} {b && <em className="text-gold-deep italic">{b}</em>}
        </h1>
        {subtitle && <p className={cn('font-light text-ink/60', compact ? 'mt-2 max-w-2xl text-sm md:text-base' : 'mt-6 max-w-xl text-lg')}>{subtitle}</p>}
        {children}
      </Container>
    </section>
  );
}
