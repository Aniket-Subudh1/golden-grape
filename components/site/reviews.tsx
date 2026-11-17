import { Star } from 'lucide-react';
import { interpolate, type Dictionary } from '@/lib/i18n';
import type { CachedReview } from '@/modules/reviews/service';

type Props = {
  t: Dictionary['socialProof'];
  locale: string;
  rating: number | null;
  total: number | null;
  reviews: CachedReview[];
  mapsUri: string | null;
  leaveHref: string;
};

const external = { target: '_blank', rel: 'noopener noreferrer' };

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className ?? ''}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-gold text-gold' : 'text-gold/30'}`} strokeWidth={1.25} />
      ))}
    </span>
  );
}

/**
 * "Ils parlent de nous" (M3.3 T1): the place's Google Maps rating and up to five recent reviews, as Google Maps gives
 * them (most relevant first), each with its author, link and visit month, and "Leave a review" (/r). Only rendered
 * when fresh reviews exist (modules/reviews/service.ts).
 */
export function Reviews({ t, locale, rating, total, reviews, mapsUri, leaveHref }: Props) {
  const visit = (ym: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-15T12:00:00Z`));
  const score = rating ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating) : null;
  return (
    <section className="bg-bone py-24 md:py-32" data-testid="google-reviews">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <span className="eyebrow text-gold-deep">{t.eyebrow}</span>
            <h2 className="mt-4 font-serif text-4xl leading-tight md:text-6xl">
              {t.titleA} <em className="text-gold-deep">{t.titleB}</em>
            </h2>
          </div>
          {score && (
            <div className="flex items-center gap-4">
              <span className="font-serif text-6xl leading-none">{score}</span>
              <div>
                <Stars value={rating!} />
                <p className="text-ink/60 mt-1 text-sm">
                  {total ? interpolate(t.count, { count: new Intl.NumberFormat(locale).format(total) }) : null}
                </p>
              </div>
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((r, i) => (
              <li key={`${r.author}-${i}`} className="flex flex-col border border-border bg-white p-7">
                <div className="flex items-center gap-3">
                  {r.photoUri ? (
                    // Google's own avatar URL (googleusercontent): attribution as Google asks; not resized by Next.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUri} alt="" width={40} height={40} className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="bg-champagne text-gold-deep grid h-10 w-10 place-items-center rounded-full font-serif">{r.author.charAt(0)}</span>
                  )}
                  <div className="min-w-0">
                    {r.authorUri ? (
                      <a href={r.authorUri} {...external} className="block truncate font-medium hover:text-gold-deep">
                        {r.author}
                      </a>
                    ) : (
                      <span className="block truncate font-medium">{r.author}</span>
                    )}
                    <span className="flex items-center gap-2 text-xs text-ink/55">
                      <Stars value={r.rating} />
                      <span className="sr-only">{interpolate(t.stars, { count: r.rating })}</span>
                      {r.relative}
                    </span>
                  </div>
                </div>
                <p className="mt-5 line-clamp-6 flex-1 font-serif text-lg leading-relaxed" lang={r.language ?? undefined}>
                  “{r.text}”
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/55">
                  {r.visit && <span>{interpolate(t.visited, { date: visit(r.visit) })}</span>}
                  {r.url && (
                    <a href={r.url} {...external} className="hover:text-gold-deep underline-offset-2 hover:underline">
                      {t.onMaps}
                    </a>
                  )}
                  {r.flagUrl && (
                    <a href={r.flagUrl} {...external} className="hover:text-gold-deep underline-offset-2 hover:underline">
                      {t.report}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-12 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-ink/55">
            {t.order} <span className="font-medium text-ink/70">Google Maps</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={leaveHref} className="bg-ink text-bone hover:bg-gold-deep inline-flex h-12 items-center px-7 text-sm tracking-wide transition" data-testid="leave-review">
              {t.leave}
            </a>
            {mapsUri && (
              <a href={mapsUri} {...external} className="border-ink hover:bg-ink hover:text-bone inline-flex h-12 items-center border px-7 text-sm tracking-wide transition">
                {t.readAll}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
