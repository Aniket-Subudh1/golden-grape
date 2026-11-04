import { Prose } from '@/components/site/blocks';
import { MediaCard } from '@/components/site/media-card';
import type { Dictionary, Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { ProductCardData } from '@/modules/webshop/service';
import { MenuAction } from './menu-action';

type Props = { item: ProductCardData; locale: Locale; t: Dictionary['snackPage']; steps: { minus: string; plus: string } };

/** A counter dish (prototype MenuCard): photo 4/3, label, name and price, description, allergens, add / stepper. */
export function MenuCard({ item, locale, t, steps }: Props) {
  const tag = item.badge ? (t.tags as Record<string, string>)[item.badge] : undefined;
  const allergens = (item.allergens ?? []).map((a) => (t.allergens as Record<string, string>)[a] ?? a);
  return (
    <MediaCard image={item.photo?.src} alt={item.photo?.alt ?? item.name} ratio="4/3" tag={tag} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw">
      <div className="flex flex-1 flex-col p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-serif text-2xl font-light md:text-3xl">{item.name}</h3>
          {item.priceCents !== null && <span className="text-sm text-ink/60 tabular-nums">{formatMoney(item.priceCents, locale)}</span>}
        </div>
        {item.description ? (
          <Prose data={item.description as never} className="mt-3 flex-1 text-sm leading-relaxed font-light text-ink/60 [&_p]:m-0" />
        ) : (
          <div className="flex-1" />
        )}
        {allergens.length > 0 && (
          <p className="mt-4 text-[11px] text-ink/45">
            <span className="eyebrow mr-1.5 text-[9px] text-ink/50">{t.allergensLabel}</span>
            {allergens.join(' · ')}
          </p>
        )}
        <div className="mt-6">{item.variant && <MenuAction variant={item.variant} label={t.add} steps={steps} disabled={!item.inStock} soldOut={t.soldOut} />}</div>
      </div>
    </MediaCard>
  );
}
