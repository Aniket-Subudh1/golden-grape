import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './container';

type Props = { eyebrow?: string | null; title: [string, string?]; subtitle?: string | null; children?: ReactNode; className?: string };

/** Page header of the inner pages: eyebrow, serif title with a gold italic second half, subtitle. */
export function PageHero({ eyebrow, title: [a, b], subtitle, children, className }: Props) {
  return (
    <section className={cn('relative overflow-hidden pt-36 pb-14 md:pt-48', className)}>
      <div
        className="bg-azulejo pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)] md:block"
        aria-hidden="true"
      />
      <Container className="relative px-6">
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
