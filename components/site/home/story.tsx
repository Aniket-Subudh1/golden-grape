import Image from 'next/image';
import { ScrollWords } from '@/components/site/scroll-words';
import type { Dictionary } from '@/lib/i18n';

export function Story({ t }: { t: Dictionary['story'] }) {
  return (
    <section className="relative overflow-hidden bg-ink py-32 text-bone md:py-48">
      <div className="bg-azulejo pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ backgroundImage: 'radial-gradient(ellipse at center, var(--ink) 25%, transparent 75%)' }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Image src="/brand/mark.png" alt="" width={223} height={240} className="mx-auto mb-10 h-16 w-auto md:h-20" />
        <span className="eyebrow text-gold">{t.eyebrow}</span>
        <p className="mt-10 font-serif text-3xl leading-[1.25] font-light text-bone md:text-5xl">
          <ScrollWords text={t.quote} />
        </p>
        <div className="mt-14 flex flex-col items-center gap-4">
          <span className="h-px w-16 bg-gold" />
          <span className="eyebrow text-bone/60">Golden Grape · Mäi Wäin</span>
        </div>
      </div>
    </section>
  );
}
