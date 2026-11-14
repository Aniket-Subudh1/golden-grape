import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './container';

type Props = {
  eyebrow?: string | null;
  title: [string, string?];
  subtitle?: string | null;
  children?: ReactNode;
  className?: string;
  /** `h2` when the CMS hero block is not the page's first block. */
  as?: 'h1' | 'h2';
  /** The CMS hero block's photo, faded behind the text; `eager` when it opens the page. */
  image?: { src: string } | null;
  eager?: boolean;
};

/**
 * Page header of the inner pages and of the CMS "hero" block (Maison): eyebrow, serif title with a gold italic second
 * half, subtitle. One layout everywhere, the Boutique's: the space under the fixed header (`pt-header`) and a compact
 * title, so the content is what the eye meets first (APPLUX report 4 §1; QA 14 Nov, GG-25).
 */
export function PageHero({ eyebrow, title: [a, b], subtitle, children, className, as: Tag = 'h1', image, eager }: Props) {
  return (
    <section className={cn('pt-header relative overflow-hidden pb-6 md:pb-8', className)}>
      {image && (
        <div className="absolute inset-0">
          <Image src={image.src} alt="" fill loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} sizes="100vw" className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-bone via-bone/70 to-bone" />
        </div>
      )}
      <div
        className="bg-azulejo pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)] md:block"
        aria-hidden="true"
      />
      <Container className="relative px-6">
        {eyebrow && <p className="eyebrow mb-2 text-gold-deep">{eyebrow}</p>}
        <Tag className="max-w-4xl font-serif text-3xl leading-tight tracking-tight md:text-5xl">
          {a} {b && <em className="text-gold-deep italic">{b}</em>}
        </Tag>
        {subtitle && <p className="mt-2 max-w-2xl text-sm font-light text-ink/60 md:text-base">{subtitle}</p>}
        {children}
      </Container>
    </section>
  );
}
