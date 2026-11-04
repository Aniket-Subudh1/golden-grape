import type { Payload } from 'payload';
import { formatMoney } from '@/lib/money';
import Image from 'next/image';
import { stockSummary } from '@/modules/inventory/service';

// Product list cells (server components: they read the row's photo, sizes and stock).

type CellProps = { rowData: Record<string, unknown>; payload: Payload; i18n: { language: string } };

const TEXT = {
  fr: { from: 'dès', inStock: (n: number) => `${n} en stock`, low: (n: number) => `${n} · stock bas`, out: 'Rupture', made: 'Préparé sur place', none: 'Aucun format' },
  en: { from: 'from', inStock: (n: number) => `${n} in stock`, low: (n: number) => `${n} · low stock`, out: 'Out of stock', made: 'Made to order', none: 'No size' },
  de: { from: 'ab', inStock: (n: number) => `${n} auf Lager`, low: (n: number) => `${n} · niedrig`, out: 'Ausverkauft', made: 'Frisch zubereitet', none: 'Kein Format' },
  pt: { from: 'desde', inStock: (n: number) => `${n} em stock`, low: (n: number) => `${n} · stock baixo`, out: 'Esgotado', made: 'Feito na hora', none: 'Sem formato' },
};
const TAGS = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', pt: 'pt-PT' };
const lang = (i18n: { language: string }) => (i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT;

/** The first photo as a small square, or an empty tile. */
export async function PhotoCell({ rowData, payload }: CellProps) {
  const first = Array.isArray(rowData.images) ? rowData.images[0] : undefined;
  const id = typeof first === 'object' && first ? (first as { id: string }).id : (first as string | undefined);
  const media = id ? await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true, disableErrors: true }) : null;
  const src = media?.sizes?.thumb?.url ?? media?.url;
  return <span className="gg-thumb">{src ? <Image src={src} alt="" width={44} height={44} unoptimized /> : null}</span>;
}

/**
 * The category name. Rendered on the server like the photo and price: Payload's client relationship cell loads names
 * in one batch, which misses rows that arrive after the async cells above, and showed "—" for them.
 */
export async function CategoryCell({ rowData, payload, i18n }: CellProps) {
  const ref = rowData.category;
  const id = typeof ref === 'object' && ref ? (ref as { id: string }).id : (ref as string | undefined);
  const category = id
    ? await payload.findByID({ collection: 'categories', id, depth: 0, locale: lang(i18n), overrideAccess: true, disableErrors: true })
    : null;
  return <span>{category?.name ?? '—'}</span>;
}

/** Price (the lowest of its sizes) and what is in stock across them, at a glance. */
export async function OfferCell({ rowData, payload, i18n }: CellProps) {
  const t = TEXT[lang(i18n)];
  const { docs } = await payload.find({
    collection: 'variants',
    where: { product: { equals: rowData.id } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
    select: { priceCents: true, trackStock: true },
  });
  if (docs.length === 0) return <span className="gg-offer gg-offer--muted">{t.none}</span>;
  const prices = docs.map((v) => v.priceCents);
  const min = Math.min(...prices);
  const tracked = docs.filter((v) => v.trackStock !== false).map((v) => v.id);
  const price = `${prices.length > 1 && Math.max(...prices) !== min ? `${t.from} ` : ''}${formatMoney(min, TAGS[lang(i18n)])}`;
  let stock = <span className="gg-badge gg-badge--neutral">{t.made}</span>;
  if (tracked.length) {
    const { onHand: total, low } = await stockSummary(payload, tracked);
    stock =
      total <= 0 ? (
        <span className="gg-badge gg-badge--danger">{t.out}</span>
      ) : low ? (
        <span className="gg-badge gg-badge--warning">{t.low(total)}</span>
      ) : (
        <span className="gg-badge gg-badge--success">{t.inStock(total)}</span>
      );
  }
  return (
    <span className="gg-offer">
      <b>{price}</b>
      {stock}
    </span>
  );
}
