'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';
import { lookupBarcode, type ScanCard, searchItems } from '@/modules/catalogue/actions';
import { type CardTexts, ProductCard } from './product-card';
import { ScanField, type ScanTexts } from './scan-field';

type Texts = { scan: ScanTexts; card: CardTexts; notFound: string; createProduct: string; noResults: string; results: string; adjust: string; count: string; sell: string };
type Can = { adjust: boolean; count: boolean; sell: boolean; create: boolean };

/**
 * Scan → product card → Adjust, Count, Sell (M3.1 T3), filtered by role. A code that is no barcode is searched as
 * words (name, sku), for products without a label at hand.
 */
export function ScanLookup({ locale, t, can }: { locale: Locale; t: Texts; can: Can }) {
  const [pending, start] = useTransition();
  const [found, setFound] = useState<{ card: ScanCard; unit: string | null } | null>(null);
  const [results, setResults] = useState<ScanCard[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);

  const onScan = (code: string) =>
    start(async () => {
      setFound(null);
      setResults(null);
      setMissing(null);
      const hit = await lookupBarcode(null, { code });
      if (hit.ok) return setFound(hit.data);
      const words = code.length >= 2 ? await searchItems(null, { q: code }) : null;
      if (words?.ok && words.data.length === 1) return setFound({ card: words.data[0], unit: null });
      if (words?.ok && words.data.length > 1) return setResults(words.data);
      setMissing(code);
    });

  const actions = (card: ScanCard, unit: string | null) => (
    <>
      {can.adjust && card.trackStock && (
        <Button asChild variant="outline" size="md" className="flex-1">
          <Link href={`/staff/stock/${card.variant}`}>{t.adjust}</Link>
        </Button>
      )}
      {can.count && card.trackStock && (
        <Button asChild variant="outline" size="md" className="flex-1">
          <Link href="/staff/count">{t.count}</Link>
        </Button>
      )}
      {can.sell && (
        <Button asChild size="md" className="flex-1">
          <Link href={`/staff/sale?add=${card.variant}${unit ? `&unit=${unit}` : ''}`}>{t.sell}</Link>
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <ScanField onScan={onScan} t={t.scan} busy={pending} />
      {found && (
        <ProductCard item={found.card} locale={locale} t={t.card}>
          {actions(found.card, found.unit)}
        </ProductCard>
      )}
      {results && (
        <section>
          <p className="eyebrow mb-2 text-ink/60">{t.results}</p>
          <ul className="space-y-2">
            {results.map((card) => (
              <li key={card.variant}>
                <button type="button" onClick={() => (setFound({ card, unit: null }), setResults(null))} className="flex w-full items-center justify-between rounded-xl border border-border bg-white/70 px-4 py-3 text-left">
                  <span>
                    <span className="block">{card.name}</span>
                    <span className="text-xs text-ink/55">{[card.label, card.sku].filter(Boolean).join(' · ')}</span>
                  </span>
                  {card.trackStock && <span className="tabular-nums text-ink/70">{card.onHand}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {missing && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm">
          <p>{t.notFound.replace('{{code}}', missing)}</p>
          {can.create && (
            <Link href="/admin/collections/products/create" className="eyebrow mt-3 inline-block text-gold-deep">
              {t.createProduct}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
