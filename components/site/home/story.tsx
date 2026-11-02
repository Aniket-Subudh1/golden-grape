import { type Dictionary, rich } from '@/lib/i18n';

export function Story({ t }: { t: Dictionary['story'] }) {
  return (
    <section className="relative overflow-hidden bg-ink py-32 text-bone md:py-48">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, var(--gold) 0%, transparent 50%), radial-gradient(circle at 80% 70%, var(--gold-deep) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <span className="eyebrow text-gold">{t.eyebrow}</span>
        <p className="mt-10 font-serif text-3xl leading-[1.25] font-light text-bone md:text-5xl">
          {rich(t.quote, (chunk, key) => (
            <em key={key} className="text-gold-gradient not-italic">
              {chunk}
            </em>
          ))}
        </p>
        <div className="mt-14 flex flex-col items-center gap-4">
          <span className="h-px w-16 bg-gold" />
          <span className="eyebrow text-bone/60">Golden Grape · Mäi Wäin</span>
        </div>
      </div>
    </section>
  );
}
