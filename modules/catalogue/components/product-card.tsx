import Link from 'next/link';
import { MediaCard } from '@/components/site/media-card';
import { type Dictionary, interpolate, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { ProductCardData } from '@/modules/webshop/service';
import { AddButton } from './add-button';

type Props = { product: ProductCardData; locale: Locale; t: Dictionary['shop']; sizes?: string };

/** A shop product (prototype ProductCard): photo 4/5, label, "+" to add one bottle, region, name, price. */
export function ProductCard({ product: p, locale, t, sizes }: Props) {
  const tag = p.badge ? (t.tags as Record<string, string>)[p.badge] : undefined;
  return (
    <MediaCard
      image={p.photo?.src}
      alt={p.photo?.alt ?? p.name}
      ratio="4/5"
      tag={tag}
      sizes={sizes ?? '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'}
      action={p.variant && <AddButton variant={p.variant} label={interpolate(t.addAria, { name: p.name })} disabled={!p.inStock} />}
    >
      <div className="p-4 md:p-5">
        {p.region && <p className="text-[10px] tracking-[0.22em] text-ink/40 uppercase">{p.region}</p>}
        <h3 className="mt-1.5 font-serif text-lg leading-tight font-light md:text-xl">
          {/* The link covers the whole card; the "+" stays above it. */}
          <Link href={localePath(locale, `/shop/${p.slug}`)} className="after:absolute after:inset-0 hover:text-gold-deep">
            {p.name}
          </Link>
        </h3>
        <p className="mt-2 flex items-baseline gap-2 text-sm tabular-nums">
          {p.priceCents !== null && (
            <span>
              {p.from && <span className="text-ink/50">{t.from} </span>}
              {formatMoney(p.priceCents, locale)}
            </span>
          )}
          {!p.inStock && <span className="eyebrow text-[9px] text-ink/40">{t.outOfStock}</span>}
        </p>
      </div>
    </MediaCard>
  );
}
