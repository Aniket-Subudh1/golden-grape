'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Parallax } from '@/components/site/parallax';
import { Reveal } from '@/components/site/reveal';
import { useNow } from '@/components/site/use-now';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';
import { isOpenNow } from '@/lib/time';

type Props = {
  image?: string | null;
  t: Dictionary['store'];
  address: string[];
  hours: { days: string; slots: string }[];
  /** Raw BusinessSettings hours, for the "open now" label. */
  schedule: { day: string; open: string; close: string }[];
  closedDates: { date: string }[];
  directionsHref: string;
  tastingHref: string;
};

export function Store({ t, address, hours, schedule, closedDates, directionsHref, tastingHref, image }: Props) {
  const now = useNow();
  const open = now === undefined ? undefined : isOpenNow(schedule, closedDates, new Date(now));
  return (
    <section className="relative overflow-hidden bg-ink text-bone">
      <div className="grid min-h-[100svh] grid-cols-1 md:grid-cols-12">
        <div className="relative aspect-[4/3] overflow-hidden md:col-span-7 md:aspect-auto">
          <Parallax>
            {image && <Image src={image} alt="" fill sizes="(min-width: 768px) 58vw, 100vw" className="object-cover" />}
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink/70" />
        </div>

        <div className="relative flex items-center px-6 py-20 md:col-span-5 md:px-14 md:py-0">
          <Reveal>
            <div className="max-w-md">
              <span className="eyebrow text-gold">{t.eyebrow}</span>
              <h2 className="mt-6 font-serif text-4xl leading-[1.02] font-light md:text-6xl">
                {t.titleA}
                <br />
                <span className="text-gold-gradient italic">{t.titleB}</span>
              </h2>
              <p className="mt-8 text-base leading-relaxed font-light text-bone/70">{t.body}</p>

              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 text-sm font-light">
                <div>
                  <dt className="eyebrow text-bone/50">{t.addressLabel}</dt>
                  <dd className="mt-2 text-bone">
                    {address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-bone/50">{t.hoursLabel}</dt>
                  <dd className="mt-2 space-y-2 text-bone">
                    {hours.map((h) => (
                      <span key={h.days} className="block">
                        <span className="block">{h.days}</span>
                        <span className="block">{h.slots}</span>
                      </span>
                    ))}
                    {open !== undefined && (
                      <span className={open ? 'flex items-center gap-2 text-gold' : 'flex items-center gap-2 text-bone/50'}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                        {open ? t.openNow : t.closedNow}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-10 flex flex-wrap items-center gap-6">
                <Button asChild variant="goldGlass" size="md">
                  <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                    {t.directions}
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </a>
                </Button>
                <Link
                  href={tastingHref}
                  className="border-b border-transparent pb-1 text-[11px] tracking-[0.3em] text-bone/70 uppercase transition hover:border-gold hover:text-gold"
                >
                  {t.tasting}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
