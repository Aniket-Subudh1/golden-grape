import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  image?: string | null;
  alt: string;
  ratio: '4/5' | '4/3';
  tag?: string;
  /** Text laid over the bottom of the image (event style). */
  overlay?: ReactNode;
  /** Button in the image's bottom-right corner. */
  action?: ReactNode;
  children?: ReactNode;
  sizes?: string;
  /** The first cards of a page: loaded at once (they are the largest image on screen). */
  priority?: boolean;
};

export function MediaCard({ image, alt, ratio, tag, overlay, action, children, sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw', priority }: Props) {
  return (
    <article className="group relative flex flex-col bg-bone">
      <div className={cn('relative overflow-hidden bg-ink', ratio === '4/5' ? 'aspect-[4/5]' : 'aspect-[4/3]')}>
        {/* No photo yet (GG-038): the house mark on the dark tile, never an empty box. */}
        {!image && <Image src="/brand/mark.png" alt="" width={223} height={240} className="absolute top-1/2 left-1/2 w-16 -translate-x-1/2 -translate-y-1/2 opacity-30" />}
        {image && (
          <Image
            src={image}
            alt={alt}
            fill
            sizes={sizes}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className="object-cover transition-transform duration-[1400ms] group-hover:scale-105"
          />
        )}
        {tag && <span className="eyebrow absolute top-3 left-3 bg-ink/70 px-2.5 py-1 text-bone backdrop-blur">{tag}</span>}
        {overlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 via-35% to-transparent to-65%" />
            <div className="absolute right-0 bottom-0 left-0 p-6 text-bone">{overlay}</div>
          </>
        )}
        {action && <div className="absolute right-3 bottom-3">{action}</div>}
      </div>
      {children}
    </article>
  );
}
