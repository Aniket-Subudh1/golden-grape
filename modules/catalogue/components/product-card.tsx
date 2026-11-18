import Link from 'next/link';
import { MediaCard } from '@/components/site/media-card';
import { type Dictionary, interpolate, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { NotInDelivery } from '@/modules/webshop/components/delivery-gate';
import type { ProductCardData } from '@/modules/webshop/service';
import { AddButton } from './add-button';

type Props = { product: ProductCardData; locale: Locale; t: Dictionary['shop']; sizes?: string; priority?: boolean };

/**
 * A shop product (prototype ProductCard): photo 4/5, label, "+" to add one bottle (or the sold-out ribbon), region, name,
 * price. A "pickup only" product is not shown in Delivery mode (client request 18 Nov).
 */
export function ProductCard({ product: p, locale, t, sizes, priority }: Props) {
  const tag = p.badge ? (t.tags as Record<string, string>)[p.badge] : undefined;
  const card = (
    <MediaCard
      image={p.photo?.src}
      alt={p.photo?.alt ?? p.name}
      ratio="4/5"
      tag={tag}
      sizes={sizes ?? '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'}
      priority={priority}
      // Sold out: the ribbon, and no "+" at all (APPLUX report 4, §1).
      ribbon={p.inStock ? undefined : t.outOfStock}
      action={
        p.variant && p.inStock && <AddButton variant={p.variant} label={interpolate(t.addAria, { name: p.name })} />
      }
    >
      <div className="p-4 md:p-5">
        {p.region && <p className="text-ink/40 text-[10px] tracking-[0.22em] uppercase">{p.region}</p>}
        <h3 className="mt-1.5 font-serif text-lg leading-tight font-light md:text-xl">
          {/* The link covers the whole card; the "+" stays above it. */}
          <Link
            href={localePath(locale, `/shop/${p.slug}`)}
            className="hover:text-gold-deep after:absolute after:inset-0"
          >
            {p.name}
          </Link>
        </h3>
        <p className="mt-2 text-sm tabular-nums">
          {p.priceCents !== null && (
            <span>
              {p.from && <span className="text-ink/50">{t.from} </span>}
              {p.wasCents !== null && <s className="text-ink/40 mr-1.5">{formatMoney(p.wasCents, locale)}</s>}
              <span className={p.wasCents !== null ? 'text-gold-deep' : undefined}>
                {formatMoney(p.priceCents, locale)}
              </span>
            </span>
          )}
        </p>
      </div>
    </MediaCard>
  );
  return p.deliverable ? card : <NotInDelivery>{card}</NotInDelivery>;
}
