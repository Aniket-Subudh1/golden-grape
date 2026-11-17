'use client';

import { FileText, Minus, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { lookupBarcode, searchItems, type ScanCard } from '@/modules/catalogue/actions';
import { sendB2bQuotationAction } from '@/modules/documents/actions';
import { placeStaffSale, quoteStaffSale } from '@/modules/sales/actions';
import type { CustomerTexts, PickedCustomer } from './customer-form';
import { CustomerRow, CustomerSheet } from './customers-screen';
import { CustomerSearch } from './customer-search';
import { ScanField, type ScanTexts } from './scan-field';
import { missed, scanned } from './feedback';
import { NO_SALE_EXTRAS, type SaleExtras, SaleExtrasCard } from './sale-extras';
import { SuccessTick } from './success-tick';

type Line = { variant: string; unit?: string; qty: number };
type Quote = NonNullable<Extract<Awaited<ReturnType<typeof quoteStaffSale>>, { ok: true }>['data']>;

type Texts = {
  scan: ScanTexts;
  customer: string;
  change: string;
  newCustomer: string;
  cancel: string;
  search: { search: string; placeholder: string; none: string };
  form: CustomerTexts;
  extras: Dictionary['cart']['extras'];
  badges: { privateBadge: string; businessBadge: string };
  items: string;
  noItems: string;
  results: string;
  notFound: string;
  clamped: string;
  vat: string;
  total: string;
  pay: string;
  onsite: string;
  onsiteHint: string;
  invoice: string;
  invoiceHint: string;
  confirm: string;
  placing: string;
  needCustomer: string;
  error: string;
  outOfStock: string;
  doneTitle: string;
  donePaid: string;
  doneInvoice: string;
  again: string;
  remove: string;
  qty: string;
  sendQuote: string;
  sendQuoteHint: string;
  quoteSentTitle: string;
  quoteSentBody: string;
};

/**
 * The mobile sale (M3.1 T5): pick or create the customer, scan or search the items (a box's barcode adds a box),
 * see the price `quote` gives that customer, then "Payé sur place" or "Facture plus tard". The order is placed by
 * the same service as the website's, on the mobile channel, and stock goes out at once.
 */
export function SaleScreen({
  locale,
  t,
  messages,
  initial,
}: {
  locale: Locale;
  t: Texts;
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
  initial: Line[];
}) {
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [creating, setCreating] = useState(false);
  const [lines, setLines] = useState<Line[]>(initial);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [results, setResults] = useState<ScanCard[] | null>(null);
  const [payment, setPayment] = useState<'onsite' | 'invoice'>('onsite');
  const [done, setDone] = useState<{ number: string; payment: 'onsite' | 'invoice' | 'quotation' } | null>(null);
  const [pending, start] = useTransition();
  // One key per sale: a double tap or a retry after a lost answer places it once (02 §6).
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [extras, setExtras] = useState<SaleExtras>(NO_SALE_EXTRAS);

  // Live totals: priced on the server for this customer, 250 ms after the last change. Lines the stock cannot cover
  // come back clamped; the sale takes the corrected quantities.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (lines.length === 0) return setQuote(null);
      const r = await quoteStaffSale(null, { customer: customer?.id, lines, code: extras.code || undefined, useLoyalty: extras.useLoyalty, giftCards: extras.giftCards });
      if (!r.ok || !r.data) return;
      setQuote(r.data);
      if (r.data.notices.length > 0) {
        toast.warning(t.clamped);
        setLines(r.data.lines.map((l) => ({ variant: l.variant, unit: l.unit ?? undefined, qty: l.qty })));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [lines, customer, extras, t.clamped]);

  const add = (variant: string, unit?: string) =>
    setLines((prev) => {
      const found = prev.find((l) => l.variant === variant && l.unit === unit);
      return found
        ? prev.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { variant, unit, qty: 1 }];
    });
  const setQty = (i: number, qty: number) =>
    setLines((prev) => (qty <= 0 ? prev.filter((_, j) => j !== i) : prev.map((l, j) => (j === i ? { ...l, qty } : l))));

  const onScan = async (code: string) => {
    setResults(null);
    const hit = await lookupBarcode(null, { code });
    if (hit.ok) {
      scanned();
      return add(hit.data.card.variant, hit.data.unit ?? undefined);
    }
    const words = await searchItems(null, { q: code });
    if (words.ok && words.data.length === 1) return (scanned(), add(words.data[0].variant));
    if (words.ok && words.data.length > 1) return setResults(words.data);
    // A gift card's QR (16 characters, no look-alikes): it pays, it is not an item.
    const card = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{16}$/.test(card)) {
      scanned();
      return setExtras((c) => (c.giftCards.includes(card) ? c : { ...c, giftCards: [...c.giftCards, card].slice(0, 5) }));
    }
    missed();
    toast.error(interpolate(t.notFound, { code }));
  };

  const place = () =>
    start(async () => {
      if (!customer) return void toast.error(t.needCustomer);
      const r = await placeStaffSale(null, { idempotencyKey: key, customer: customer.id, lines, payment, code: extras.code || undefined, useLoyalty: extras.useLoyalty, giftCards: extras.giftCards });
      if (r.ok) {
        setDone({ number: r.data.number, payment });
        return;
      }
      const why = (t.extras.reasons as Record<string, string>)[r.message ?? ''];
      toast.error(r.error === 'OUT_OF_STOCK' ? t.outOfStock : (why ?? t.error));
      // A new key: the next try is a new sale (this one was refused, nothing was written).
      setKey(crypto.randomUUID());
    });

  // A business customer may get a quotation instead (M3.2 T5): their prices, numbered, e-mailed; nothing is sold yet.
  const sendQuote = () =>
    start(async () => {
      if (!customer) return void toast.error(t.needCustomer);
      const r = await sendB2bQuotationAction(null, { customer: customer.id, lines });
      if (r.ok) return void setDone({ number: r.data.number, payment: 'quotation' });
      toast.error(r.error === 'OUT_OF_STOCK' ? t.outOfStock : t.error);
    });

  if (done) {
    return (
      <div className="gg-card mx-auto max-w-md space-y-4 p-6 text-center" role="status">
        <SuccessTick />
        <h2 className="font-serif text-2xl">{done.payment === 'quotation' ? t.quoteSentTitle : t.doneTitle}</h2>
        <p className="font-serif text-3xl" data-testid="order-number">
          {done.number}
        </p>
        <p className="text-ink/70 text-sm">{done.payment === 'quotation' ? t.quoteSentBody : done.payment === 'onsite' ? t.donePaid : t.doneInvoice}</p>
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setKey(crypto.randomUUID());
            setDone(null);
            setLines([]);
            setQuote(null);
            setCustomer(null);
            setExtras(NO_SALE_EXTRAS);
          }}
        >
          {t.again}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="eyebrow text-ink/60">{t.customer}</h2>
          {customer ? (
            <div className="gg-card border-gold-deep/40 bg-champagne/40 px-4 py-3" data-testid="sale-customer">
              <CustomerRow
                c={customer}
                t={t.badges}
                trailing={
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="text-gold-deep shrink-0 text-sm font-medium hover:underline"
                  >
                    {t.change}
                  </button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <CustomerSearch
                  t={t.search}
                  render={(c) => (
                    <button
                      type="button"
                      onClick={() => setCustomer(c)}
                      className="gg-card w-full px-4 py-3 transition hover:shadow-md"
                    >
                      <CustomerRow c={c} t={t.badges} />
                    </button>
                  )}
                />
              </div>
              <Button type="button" variant="outline" className="h-12 sm:mt-[1.6rem]" onClick={() => setCreating(true)}>
                <UserPlus className="h-4 w-4" />
                {t.newCustomer}
              </Button>
            </div>
          )}
          <CustomerSheet
            open={creating}
            onOpenChange={setCreating}
            title={t.newCustomer}
            closeLabel={t.cancel}
            t={t.form}
            messages={messages}
            onDone={(c) => {
              setCustomer(c as PickedCustomer);
              setCreating(false);
            }}
          />
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow text-ink/60">{t.items}</h2>
          <ScanField onScan={onScan} t={t.scan} busy={pending} />
          {results && (
            <ul className="space-y-2" aria-label={t.results}>
              {results.map((card) => (
                <li key={card.variant}>
                  <button
                    type="button"
                    onClick={() => (add(card.variant), setResults(null))}
                    className="gg-card flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block">{card.name}</span>
                      <span className="text-ink/55 text-xs">{[card.label, card.sku].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="text-ink/70 tabular-nums">{formatMoney(card.priceCents, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lines.length === 0 ? (
            <p className="border-border text-ink/55 rounded-xl border border-dashed p-6 text-center text-sm">
              {t.noItems}
            </p>
          ) : (
            <ul className="divide-border gg-card divide-y">
              {lines.map((line, i) => {
                const q = quote?.lines.find((l) => l.variant === line.variant && (l.unit ?? undefined) === line.unit);
                const name = q ? [q.name, q.detail].filter(Boolean).join(' · ') : '…';
                return (
                  <li key={`${line.variant}:${line.unit ?? ''}`} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block">{name}</span>
                      {q && <span className="text-ink/55 text-xs">{formatMoney(q.unitPriceCents, locale)}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={line.qty === 1 ? t.remove : '−'}
                      onClick={() => setQty(i, line.qty - 1)}
                      className="border-border grid h-11 w-11 place-items-center rounded-full border"
                    >
                      {line.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                    <span className="w-7 text-center tabular-nums" aria-label={`${t.qty} ${name}`}>
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="+"
                      onClick={() => setQty(i, line.qty + 1)}
                      className="border-border grid h-11 w-11 place-items-center rounded-full border"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="w-20 text-right text-sm tabular-nums">
                      {q ? formatMoney(q.totalCents, locale) : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6">
        {lines.length > 0 && <SaleExtrasCard quote={quote} extras={extras} setExtras={setExtras} t={t.extras} locale={locale} />}
        <section className="space-y-3">
          {quote && lines.length > 0 && (
            <dl className="gg-card space-y-1 px-4 py-3 text-sm">
              {quote.vatBreakdown.map((v) => (
                <div key={v.rateBp} className="text-ink/60 flex justify-between">
                  <dt>{interpolate(t.vat, { rate: v.rateBp / 100 })}</dt>
                  <dd className="tabular-nums">{formatMoney(v.vatCents, locale)}</dd>
                </div>
              ))}
              <div className="flex justify-between font-serif text-2xl">
                <dt>{t.total}</dt>
                <dd className="tabular-nums" data-testid="sale-total">
                  {formatMoney(quote.totalCents, locale)}
                </dd>
              </div>
              {(quote.loyaltyCents > 0 || quote.giftCards.length > 0) && (
                <>
                  {quote.loyaltyCents > 0 && (
                    <div className="text-ink/60 flex justify-between">
                      <dt>{interpolate(t.extras.pointsUsed, { points: quote.loyaltyPointsUsed })}</dt>
                      <dd className="tabular-nums">−{formatMoney(quote.loyaltyCents, locale)}</dd>
                    </div>
                  )}
                  {quote.giftCards.map((g) => (
                    <div key={g.code} className="text-ink/60 flex justify-between">
                      <dt>{interpolate(t.extras.card, { last: g.code.slice(-4) })}</dt>
                      <dd className="tabular-nums">−{formatMoney(g.amountCents, locale)}</dd>
                    </div>
                  ))}
                  <div className="border-border flex justify-between border-t pt-2 text-lg font-semibold">
                    <dt>{t.extras.toPay}</dt>
                    <dd className="tabular-nums" data-testid="sale-due">
                      {formatMoney(quote.amountDueCents, locale)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow text-ink/60">{t.pay}</h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.pay}>
            {(['onsite', 'invoice'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={payment === value}
                onClick={() => setPayment(value)}
                className={`rounded-xl border p-3 text-left transition ${payment === value ? 'border-ink bg-ink text-bone' : 'border-border bg-white'}`}
              >
                <span className="block text-sm">{t[value]}</span>
                <span className={`text-xs ${payment === value ? 'text-bone/70' : 'text-ink/55'}`}>
                  {t[`${value}Hint`]}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2 md:bottom-4 lg:static">
          <Button
            type="button"
            onClick={place}
            disabled={pending || lines.length === 0 || !quote}
            className="w-full shadow-lg"
          >
            {pending ? t.placing : quote ? `${t.confirm} · ${formatMoney(quote.amountDueCents, locale)}` : t.confirm}
          </Button>
          {!customer && lines.length > 0 && <p className="text-ink/60 mt-2 text-center text-xs">{t.needCustomer}</p>}
          {customer?.type === 'business' && (
            <div className="mt-3">
              <Button type="button" variant="outline" onClick={sendQuote} disabled={pending || lines.length === 0 || !quote} className="w-full" data-testid="send-quotation">
                <FileText className="h-4 w-4" aria-hidden />
                {t.sendQuote}
              </Button>
              <p className="text-ink/55 mt-1.5 text-center text-xs">{t.sendQuoteHint}</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
