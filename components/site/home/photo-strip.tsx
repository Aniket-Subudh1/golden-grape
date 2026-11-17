'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n';

// The home page's photo band, between the banners and the contact details: the house's photos (Home page settings ›
// Gallery) drifting slowly to the left, each at its own shape. It stops under the pointer or keyboard focus and with
// its pause button; under reduced motion it stands still and scrolls by hand. The list is drawn twice so the loop
// has no seam (`gg-strip` in globals.css moves it by half its width).

export type StripPhoto = { src: string; alt: string; ratio: number };

type Props = { t: Dictionary['home']['gallery']; photos: StripPhoto[]; instagram?: string | null };

export function PhotoStrip({ t, photos, instagram }: Props) {
  const [paused, setPaused] = useState(false);
  const row = (copy: boolean) =>
    photos.map((p, i) => (
      <li key={`${copy}-${i}`} aria-hidden={copy || undefined} className="shrink-0 pr-3 md:pr-5">
        <div className="group relative h-[240px] overflow-hidden bg-bone/5 md:h-[380px]" style={{ aspectRatio: p.ratio }}>
          <Image
            src={p.src}
            alt={copy ? '' : p.alt}
            fill
            sizes="(min-width: 768px) 560px, 360px"
            className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
          />
        </div>
      </li>
    ));

  return (
    <section aria-labelledby="home-gallery" className="overflow-hidden bg-ink py-16 text-bone md:py-24">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-6 px-5 md:px-10">
        <h2 id="home-gallery" className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-none font-light">
          {t.title}
        </h2>
        <div className="flex items-center gap-6">
          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border-b border-bone/30 text-[11px] tracking-[0.3em] text-bone/80 uppercase transition hover:border-gold hover:text-gold"
            >
              {t.follow}
            </a>
          )}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t.play : t.pause}
            aria-pressed={paused}
            className="grid size-11 place-items-center rounded-full border border-bone/25 text-bone/80 transition hover:border-gold hover:text-gold motion-reduce:hidden"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
              {paused ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M4 2.5h2.6v11H4zM9.4 2.5H12v11H9.4z" />}
            </svg>
          </button>
        </div>
      </div>
      <div className="gg-strip-frame mt-10 md:mt-14" data-paused={paused || undefined}>
        <ul className="gg-strip flex w-max" style={{ animationDuration: `${photos.length * 7}s` }}>
          {row(false)}
          {row(true)}
        </ul>
      </div>
    </section>
  );
}
