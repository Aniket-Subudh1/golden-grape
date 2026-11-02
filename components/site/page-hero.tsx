import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './container';

type Props = { eyebrow?: string | null; title: [string, string?]; subtitle?: string | null; children?: ReactNode; className?: string };

/** Page header of the inner pages: eyebrow, serif title with a gold italic second half, subtitle. */
export function PageHero({ eyebrow, title: [a, b], subtitle, children, className }: Props) {
  return (
    <section className={cn('pt-32 pb-14 md:pt-40', className)}>
      <Container className="px-6">
        {eyebrow && <p className="eyebrow mb-6 text-gold-deep">{eyebrow}</p>}
        <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
          {a} {b && <em className="text-gold-deep italic">{b}</em>}
        </h1>
        {subtitle && <p className="mt-6 max-w-xl text-lg font-light text-ink/60">{subtitle}</p>}
        {children}
      </Container>
    </section>
  );
}
