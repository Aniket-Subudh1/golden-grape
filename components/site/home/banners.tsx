import Image from 'next/image';
import Link from 'next/link';
import { Parallax } from '@/components/site/parallax';
import { Reveal } from '@/components/site/reveal';
import type { Dictionary } from '@/lib/i18n';

// The home page (client request 17 Nov): four large photo banners, one below the other, with a short title, one line
// and a link; the whole banner is the link. "Book a table" carries a second link (takeaway) above the first.

export type BannerKey = 'shop' | 'table' | 'catering' | 'events';
export const BANNERS: BannerKey[] = ['shop', 'table', 'catering', 'events'];

type Props = {
  t: Dictionary['home'];
  hrefs: Record<BannerKey, string> & { takeaway: string };
  /** Photos from the Home page settings; a banner without one shows the dark ground. */
  images?: Partial<Record<BannerKey, string | null>>;
};

export function Banners({ t, hrefs, images = {} }: Props) {
  return (
    <div className="grid gap-3 px-3 pt-header pb-3 md:gap-6 md:px-6 md:pb-6">
      {BANNERS.map((key, i) => {
        const b = t[key];
        return (
          <Reveal key={key} delay={i === 0 ? 0 : 80}>
            <section className="group relative flex h-[68svh] min-h-[420px] items-end overflow-hidden bg-ink text-bone md:h-[82svh] md:min-h-[560px]">
              <Parallax amount={5}>
                {images[key] && (
                  <Image
                    src={images[key]}
                    alt=""
                    fill
                    sizes="100vw"
                    {...(i === 0 ? { loading: 'eager', fetchPriority: 'high' } : {})}
                    className="object-cover opacity-85 transition duration-[1600ms] ease-out group-hover:scale-[1.03] group-hover:opacity-95"
                  />
                )}
              </Parallax>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
              <div className="relative w-full p-6 pb-8 md:p-14 md:pb-14">
                <span className="font-serif text-sm tracking-widest text-gold">0{i + 1}</span>
                <h2 className="mt-3 font-serif text-[clamp(2.25rem,6.5vw,5.75rem)] leading-[0.95] font-light tracking-[0.04em] uppercase">
                  <Link href={hrefs[key]} className="after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:ring-2 after:focus-visible:ring-gold after:focus-visible:ring-inset">
                    {b.title}
                  </Link>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed font-light text-bone/75 md:text-base">{b.text}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 text-[11px] tracking-[0.3em] uppercase">
                  <span className="inline-flex items-center gap-3 text-gold" aria-hidden="true">
                    {b.cta}
                    <span className="h-px w-8 bg-gold transition-all duration-500 group-hover:w-16" />
                  </span>
                  {key === 'table' && (
                    <Link href={hrefs.takeaway} className="relative z-10 border-b border-bone/40 pb-1 text-bone/85 transition hover:border-gold hover:text-gold">
                      {t.table.takeaway}
                    </Link>
                  )}
                </div>
              </div>
            </section>
          </Reveal>
        );
      })}
    </div>
  );
}
