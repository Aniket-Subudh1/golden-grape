'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type FilterText = {
  all: string;
  searchPh: string;
  filters: string;
  region: string;
  colour: string;
  price: string;
  min: string;
  max: string;
  any: string;
  clear: string;
  apply: string;
  close: string;
  colours: Record<string, string>;
};

type Props = {
  categories: { slug: string; name: string }[];
  regions: string[];
  colours: string[];
  t: FilterText;
};

const select = 'h-9 w-full border-b border-border bg-transparent text-sm outline-none focus:border-gold-deep';

/**
 * The shop's sticky filter bar (prototype shop.tsx): category chips, search, and region / colour / price. The URL is
 * the state, so every filtered view can be shared; search is debounced into `?q=`.
 */
export function Filters({ categories, regions, colours, t }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sheet, setSheet] = useState(false);
  const [pending, startTransition] = useTransition();
  const typed = useRef(false);

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const replace = (changes: Record<string, string | null>) =>
    startTransition(() => router.replace(hrefWith(changes), { scroll: false }));

  // Search: 350 ms after the last keystroke.
  useEffect(() => {
    if (!typed.current) return;
    const timer = window.setTimeout(() => replace({ q: q.trim() || null }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text triggers a search
  }, [q]);

  const category = params.get('category');
  const active = ['region', 'colour', 'min', 'max'].filter((k) => params.get(k)).length;

  const fields: ReactNode = (
    <>
      <label className="block">
        <span className="eyebrow text-ink/50 mb-1 block">{t.region}</span>
        <select
          className={select}
          value={params.get('region') ?? ''}
          onChange={(e) => replace({ region: e.target.value || null })}
        >
          <option value="">{t.any}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow text-ink/50 mb-1 block">{t.colour}</span>
        <select
          className={select}
          value={params.get('colour') ?? ''}
          onChange={(e) => replace({ colour: e.target.value || null })}
        >
          <option value="">{t.any}</option>
          {colours.map((c) => (
            <option key={c} value={c}>
              {t.colours[c] ?? c}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="block">
        <legend className="eyebrow text-ink/50 mb-1 block">{t.price}</legend>
        <div className="flex items-center gap-2">
          {(['min', 'max'] as const).map((key) => (
            <input
              key={key}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder={t[key]}
              aria-label={`${t.price} ${t[key]}`}
              defaultValue={params.get(key) ?? ''}
              onBlur={(e) => e.target.value !== (params.get(key) ?? '') && replace({ [key]: e.target.value || null })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="border-border placeholder:text-ink/30 focus:border-gold-deep h-9 w-full border-b bg-transparent text-sm tabular-nums outline-none"
            />
          ))}
          <span className="text-ink/40 text-sm">€</span>
        </div>
      </fieldset>
    </>
  );

  return (
    <>
      <section
        className={cn(
          'border-border/60 bg-bone/90 sticky top-20 z-30 border-y backdrop-blur-xl md:top-24',
          pending && 'opacity-90',
        )}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-4 md:px-10 lg:flex-row lg:items-center">
          <div className="no-scrollbar -mx-2 flex-1 overflow-x-auto px-2">
            <div className="inline-flex items-center gap-2 md:gap-3">
              {[{ slug: '', name: t.all }, ...categories].map((c) => (
                <Button
                  key={c.slug}
                  asChild
                  variant="chip"
                  size="sm"
                  active={(category ?? '') === c.slug}
                  className="text-[11px]"
                >
                  <Link
                    href={hrefWith({ category: c.slug || null })}
                    scroll={false}
                    aria-current={(category ?? '') === c.slug ? 'page' : undefined}
                  >
                    {c.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="border-border flex flex-1 items-center gap-2 border-b lg:w-64 lg:flex-none">
              <Search className="text-ink/40 h-4 w-4" />
              <input
                id="search"
                type="search"
                value={q}
                onChange={(e) => {
                  typed.current = true;
                  setQ(e.target.value);
                }}
                placeholder={t.searchPh}
                aria-label={t.searchPh}
                className="placeholder:text-ink/30 h-9 flex-1 bg-transparent text-sm outline-none"
              />
              {q && (
                <button
                  type="button"
                  aria-label={t.clear}
                  onClick={() => {
                    typed.current = true;
                    setQ('');
                  }}
                >
                  <X className="text-ink/40 h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <Button variant="outline" size="sm" className="shrink-0 lg:hidden" onClick={() => setSheet(true)}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t.filters}
              {active > 0 && (
                <span className="bg-gold-deep text-bone grid h-4 w-4 place-items-center rounded-full text-[9px]">
                  {active}
                </span>
              )}
            </Button>
          </div>
        </div>
        <div className="mx-auto hidden max-w-[1400px] grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-6 px-10 pb-4 lg:grid">
          {fields}
          <Link
            href={pathname + (category ? `?category=${category}` : '')}
            scroll={false}
            className={cn('eyebrow text-ink/50 hover:text-gold-deep pb-2', active === 0 && 'invisible')}
          >
            {t.clear}
          </Link>
        </div>
      </section>
      {/* Outside the bar: its backdrop blur would otherwise become the sheet's positioning box. */}
      <Sheet open={sheet} onOpenChange={setSheet} label={t.filters} closeLabel={t.close}>
        <div className="border-border/60 border-b px-6 pt-6 pb-4">
          <h2 className="font-serif text-3xl font-light">{t.filters}</h2>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">{fields}</div>
        <div className="border-border/60 flex gap-3 border-t px-6 py-5">
          <Button asChild variant="outline" className="min-w-0 flex-1 px-3 tracking-[0.18em]">
            <Link
              href={pathname + (category ? `?category=${category}` : '')}
              scroll={false}
              onClick={() => setSheet(false)}
            >
              {t.clear}
            </Link>
          </Button>
          <Button className="min-w-0 flex-1 px-3 tracking-[0.18em]" onClick={() => setSheet(false)}>
            {t.apply}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
