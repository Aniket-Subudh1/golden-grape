import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { Dictionary } from '@/lib/i18n';

// The home page (client request 17 Nov): four vertical banners (shop, table, catering, events). On a computer they
// stand side by side and fill the first screen; the one under the pointer widens and the others dim. Tablets get two
// by two, phones one below the other with every line shown. The whole banner is the link (the title's link stretches
// over the panel, so a click on the photo opens it too); "Book a table" carries a second link (takeaway) above it.
// The words are in the page from the first paint; each photo streams in and fades up when it arrives (`BannerPhoto`).
// They open once on load (`gg-panel` in globals.css), nothing on scroll.

type BannerKey = 'shop' | 'table' | 'catering' | 'events';
const BANNERS: BannerKey[] = ['shop', 'table', 'catering', 'events'];

type Props = {
  t: Dictionary['home'];
  hrefs: Record<BannerKey, string> & { takeaway: string };
  /** Each banner's photo (`BannerPhoto`, streamed in); a banner without one shows the dark ground. */
  photos?: Partial<Record<BannerKey, ReactNode>>;
};

/** A banner's photo: the first two load at once (the first screen), the others when the browser gets to them. */
export function BannerPhoto({ src, eager }: { src: string; eager?: 'high' | 'auto' }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
      {...(eager ? { loading: 'eager', fetchPriority: eager } : {})}
      className="gg-panel__photo object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.03]"
    />
  );
}

export function Banners({ t, hrefs, photos = {} }: Props) {
  return (
    <div className="group/panels bg-ink grid gap-px md:grid-cols-2 lg:flex lg:h-svh lg:max-h-[1080px] lg:min-h-[640px] lg:gap-0">
      {BANNERS.map((key, i) => {
        const b = t[key];
        return (
          <section
            key={key}
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            className="gg-panel group border-bone/15 bg-ink text-bone relative isolate flex h-[62svh] min-h-[440px] items-end overflow-hidden first:h-[76svh] first:min-h-[520px] md:h-[56svh] md:min-h-[480px] md:first:h-[56svh] md:first:min-h-[480px] lg:h-auto lg:min-h-0 lg:flex-1 lg:border-l lg:transition-[flex-grow] lg:duration-[900ms] lg:ease-[cubic-bezier(0.2,0.7,0.2,1)] lg:first:h-auto lg:first:min-h-0 lg:first:border-l-0 lg:focus-within:grow-[1.6] lg:hover:grow-[1.6]"
          >
            {/* Photo and shade sit below the words (-z-10 inside the isolated panel), so the words need no position
                of their own and the title's link can stretch over the whole panel. */}
            <div className="absolute inset-0 -z-10 transition duration-[900ms] lg:group-hover:!brightness-100 lg:group-hover/panels:brightness-[0.55]">
              {photos[key]}
            </div>
            {/* Dark at the top for the menu, darker at the foot for the words. */}
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.45),transparent_26%,transparent_40%,rgb(0_0_0/0.6)_65%,rgb(0_0_0/0.85))]" />

            {/* From tablets up the words take the same room in every banner, so titles and buttons line up across them. */}
            <div className="w-full px-6 pb-9 [text-shadow:0_1px_12px_rgb(0_0_0/0.45)] md:min-h-[22rem] md:px-8 md:pb-10 lg:px-7 xl:px-10 xl:pb-14">
              <div className="text-gold flex items-center gap-3 font-serif text-sm tracking-[0.2em]">
                <span>0{i + 1}</span>
                <span className="bg-gold/60 h-px w-8 transition-all duration-700 group-hover:w-14" />
              </div>
              <h2 className="mt-4 max-w-[14ch] font-serif text-[clamp(2.4rem,9vw,3.4rem)] leading-[0.98] font-light md:flex md:min-h-[2lh] md:items-end md:text-[clamp(2.4rem,4.6vw,3.4rem)] lg:text-[clamp(2.1rem,2.9vw,3.6rem)]">
                <Link
                  href={hrefs[key]}
                  className="after:focus-visible:ring-gold after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:ring-2 after:focus-visible:ring-inset"
                >
                  {b.title}
                </Link>
              </h2>
              <div
                // On a computer the line opens on hover or keyboard focus; on touch screens it is always there.
                className="pointer-wide:grid-rows-[0fr] pointer-wide:opacity-0 pointer-wide:group-focus-within:grid-rows-[1fr] pointer-wide:group-focus-within:opacity-100 pointer-wide:group-hover:grid-rows-[1fr] pointer-wide:group-hover:opacity-100 grid transition-all duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
              >
                <p className="min-h-0 overflow-hidden">
                  <span className="text-bone/80 block max-w-xs pt-4 text-[15px] leading-relaxed font-light">
                    {b.text}
                  </span>
                </p>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-[11px] tracking-[0.3em] uppercase lg:tracking-[0.22em] xl:tracking-[0.3em]">
                <span
                  className="text-bone inline-flex items-center gap-4 sm:whitespace-nowrap lg:gap-3 lg:whitespace-normal xl:gap-4 xl:whitespace-nowrap"
                  aria-hidden="true"
                >
                  <span className="border-gold/70 text-gold group-hover:border-gold group-hover:bg-gold group-hover:text-ink grid size-11 shrink-0 place-items-center rounded-full border transition duration-500">
                    <svg
                      viewBox="0 0 16 16"
                      className="size-4 transition-transform duration-500 group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    >
                      <path d="M2 8h11M9 4l4 4-4 4" />
                    </svg>
                  </span>
                  {b.cta}
                </span>
                {key === 'table' && (
                  <Link
                    href={hrefs.takeaway}
                    className="border-bone/40 text-bone/85 hover:border-gold hover:text-gold relative z-10 inline-flex min-h-11 items-center border-b whitespace-nowrap transition"
                  >
                    {t.table.takeaway}
                  </Link>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
