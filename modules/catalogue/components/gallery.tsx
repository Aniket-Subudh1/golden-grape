'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { Photo } from '@/modules/webshop/service';

/** Product photos: the chosen one large, the others as thumbnails beneath. */
export function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-champagne/40">
        {photo ? (
          <Image src={photo.src} alt={photo.alt || name} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="bg-azulejo absolute inset-0 opacity-20" aria-hidden="true" />
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {photos.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={p.alt || name}
              aria-current={i === index}
              className={cn('relative aspect-square overflow-hidden border transition', i === index ? 'border-gold-deep' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <Image src={p.src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
