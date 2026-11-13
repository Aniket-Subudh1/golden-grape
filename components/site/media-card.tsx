import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const RATIO = { '4/5': 'aspect-[4/5]', '4/3': 'aspect-[4/3]', '16/9': 'aspect-video' } as const;

type Props = {
  image?: string | null;
  alt: string;
  ratio: keyof typeof RATIO;
  tag?: string;
  /** The whole card opens this page (an event, QA 12 Nov GG-13): a link over it, under the card's own buttons. */
  href?: string;
  /** The whole picture, never cropped (event posters, GG-12). */
  fit?: 'contain';
  /** Diagonal band across the photo's top-right corner: "Épuisé" (APPLUX report 4, §1). The photo stays visible. */
  ribbon?: string;
  /** Button in the image's bottom-right corner. */
  action?: ReactNode;
  children?: ReactNode;
  sizes?: string;
  /** The first cards of a page: loaded at once (they are the largest image on screen). */
  priority?: boolean;
};

/** A picture shown whole over a blurred copy of itself (same file, one download): posters are never cropped (GG-12). */
export function Poster({ src, alt, sizes, priority, zoom }: { src: string; alt: string; sizes: string; priority?: boolean; zoom?: boolean }) {
  return (
    <>
      <Image src={src} alt="" aria-hidden fill sizes={sizes} className="scale-110 object-cover opacity-60 blur-2xl" />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn('object-contain', zoom && 'transition-transform duration-[1400ms] group-hover:scale-105')}
      />
    </>
  );
}

/** The sold-out corner band, on product cards and the product page's photo. */
export function Ribbon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute top-0 right-0 z-[1] h-32 w-32 overflow-hidden">
      <span className="absolute top-[26px] -right-[44px] w-[180px] rotate-45 bg-burgundy py-1.5 text-center text-[11px] font-medium tracking-[0.28em] text-bone uppercase shadow-lg">{children}</span>
    </span>
  );
}

export function MediaCard({ image, alt, ratio, tag, ribbon, href, fit, action, children, sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw', priority }: Props) {
  return (
    <article className="group relative flex flex-col bg-bone">
      <div className={cn('relative overflow-hidden bg-ink', RATIO[ratio])}>
        {/* No photo yet (GG-038): the house mark on the dark tile, never an empty box. */}
        {!image && <Image src="/brand/mark.png" alt="" width={223} height={240} className="absolute top-1/2 left-1/2 w-16 -translate-x-1/2 -translate-y-1/2 opacity-30" />}
        {image && fit === 'contain' && <Poster src={image} alt={alt} sizes={sizes} priority={priority} zoom />}
        {image && !fit && (
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
        {ribbon && <Ribbon>{ribbon}</Ribbon>}
        {action && <div className="absolute right-3 bottom-3">{action}</div>}
      </div>
      {children}
      {href && <Link href={href} aria-label={alt} className="absolute inset-0 z-[1]" />}
    </article>
  );
}
