'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';
import { Reveal } from '@/components/site/reveal';
import { happyHour } from '@/lib/brand';
import { type Dictionary, type Locale, rich } from '@/lib/i18n';
import { nextWeekly, TZ } from '@/lib/time';

// Wednesday to Friday from 17:00 until the HappyHour global replaces these in M1.3.
const DAYS = [3, 4, 5];
const START = '17:00';

// A clock in whole seconds; undefined on the server, so the prerender never bakes in a stale time.
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000) * 1000;
const noTime = () => undefined;

function Unit({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-serif text-5xl leading-none font-light text-gold tabular-nums md:text-7xl">
        {value === undefined ? '--' : String(value).padStart(2, '0')}
      </span>
      <span className="eyebrow mt-3 text-bone/60">{label}</span>
    </div>
  );
}

export function HappyHour({ t, locale }: { t: Dictionary['happyHour']; locale: Locale }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, noTime);

  const target = now === undefined ? undefined : nextWeekly(DAYS, START, new Date(now));
  const s = target && now !== undefined ? Math.max(0, Math.floor((target.getTime() - now) / 1000)) : undefined;
  const part = (fn: (s: number) => number) => (s === undefined ? undefined : fn(s));
  const dateLabel = target?.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

  return (
    <section id="happy-hour" className="relative overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0">
        <Image src={happyHour} alt="" fill sizes="100vw" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/80 to-ink" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:py-40">
        <Reveal>
          <span className="eyebrow text-gold">{t.eyebrow}</span>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] font-light md:text-6xl">
            {t.titleA}
            <br />
            <span className="text-gold-gradient italic">{t.titleB}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base font-light text-bone/70 md:text-lg">
            {rich(t.subtitle, (chunk, key) => (
              <span key={key} className="text-gold">
                {chunk}
              </span>
            ))}
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-4 gap-4 md:gap-10">
            <Unit value={part((v) => Math.floor(v / 86400))} label={t.days} />
            <Unit value={part((v) => Math.floor((v % 86400) / 3600))} label={t.hours} />
            <Unit value={part((v) => Math.floor((v % 3600) / 60))} label={t.minutes} />
            <Unit value={part((v) => v % 60)} label={t.seconds} />
          </div>
          {/* The reserve button returns with table reservations (M2.3). */}
          <div className="mt-10 flex flex-col items-center gap-6">
            <span className="min-h-5 text-sm font-light text-bone/60">
              {dateLabel && `${t.nextPour} · ${dateLabel} · ${START}`}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
