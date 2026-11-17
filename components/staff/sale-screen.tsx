'use client';

import { Minus, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { lookupBarcode, searchItems, type ScanCard } from '@/modules/catalogue/actions';
import { placeStaffSale, quoteStaffSale } from '@/modules/sales/actions';
import { CustomerForm, type CustomerTexts, type PickedCustomer } from './customer-form';
import { CustomerSearch } from './customer-search';
import { ScanField, type ScanTexts } from './scan-field';

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
};

/**
 * The mobile sale (M3.1 T5): pick or create the customer, scan or search the items (a box's barcode adds a box),
 * see the price `quote` gives that customer, then "Payé sur place" or "Facture plus tard". The order is placed by
 * the same service as the website's, on the mobile channel, and stock goes out at once.
 */
export function SaleScreen({ locale, t, messages, initial }: { locale: Locale; t: Texts; messages: { error: string; fields: Record<string, string> } & Record<string, unknown>; initial: Line[] }) {
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [creating, setCreating] = useState(false);
  const [lines, setLines] = useState<Line[]>(initial);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [results, setResults] = useState<ScanCard[] | null>(null);
  const [payment, setPayment] = useState<'onsite' | 'invoice'>('onsite');
  const [done, setDone] = useState<{ number: string; payment: 'onsite' | 'invoice' } | null>(null);
  const [pending, start] = useTransition();
  // One key per sale: a double tap or a retry after a lost answer places it once (02 §6).
  const [key, setKey] = useState(() => crypto.randomUUID());

  // Live totals: priced on the server for this customer, 250 ms after the last change. Lines the stock cannot cover
  // come back clamped; the sale takes the corrected quantities.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (lines.length === 0) return setQuote(null);
      const r = await quoteStaffSale(null, { customer: customer?.id, lines });
      if (!r.ok || !r.data) return;
      setQuote(r.data);
      if (r.data.notices.length > 0) {
        toast.warning(t.clamped);
        setLines(r.data.lines.map((l) => ({ variant: l.variant, unit: l.unit ?? undefined, qty: l.qty })));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [lines, customer, t.clamped]);

  const add = (variant: string, unit?: string) =>
    setLines((prev) => {
      const found = prev.find((l) => l.variant === variant && l.unit === unit);
      return found ? prev.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l)) : [...prev, { variant, unit, qty: 1 }];
    });
  const setQty = (i: number, qty: number) => setLines((prev) => (qty <= 0 ? prev.filter((_, j) => j !== i) : prev.map((l, j) => (j === i ? { ...l, qty } : l))));

  const onScan = async (code: string) => {
    setResults(null);
    const hit = await lookupBarcode(null, { code });
    if (hit.ok) {
      navigator.vibrate?.(40);
      return add(hit.data.card.variant, hit.data.unit ?? undefined);
    }
    const words = await searchItems(null, { q: code });
    if (words.ok && words.data.length === 1) return add(words.data[0].variant);
    if (words.ok && words.data.length > 1) return setResults(words.data);
    toast.error(interpolate(t.notFound, { code }));
  };

  const place = () =>
    start(async () => {
      if (!customer) return void toast.error(t.needCustomer);
      const r = await placeStaffSale(null, { idempotencyKey: key, customer: customer.id, lines, payment });
      if (r.ok) {
        setDone({ number: r.data.number, payment });
        return;
      }
      toast.error(r.error === 'OUT_OF_STOCK' ? t.outOfStock : t.error);
      // A new key: the next try is a new sale (this one was refused, nothing was written).
      setKey(crypto.randomUUID());
    });

  if (done) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-white/70 p-5 text-center" role="status">
        <h2 className="font-serif text-2xl">{t.doneTitle}</h2>
        <p className="font-serif text-3xl" data-testid="order-number">
          {done.number}
        </p>
        <p className="text-sm text-ink/70">{done.payment === 'onsite' ? t.donePaid : t.doneInvoice}</p>
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setKey(crypto.randomUUID());
            setDone(null);
            setLines([]);
            setQuote(null);
            setCustomer(null);
          }}
        >
          {t.again}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="eyebrow text-ink/60">{t.customer}</h2>
        {customer ? (
          <div className="flex items-center gap-3 rounded-xl border border-gold-deep/40 bg-white/70 px-4 py-3" data-testid="sale-customer">
            <UserRound className="h-5 w-5 text-gold-deep" />
            <span className="min-w-0 flex-1">
              <span className="block">{customer.company || customer.name}</span>
              <span className="text-xs text-ink/55">{[customer.company ? customer.name : null, customer.phone].filter(Boolean).join(' · ')}</span>
            </span>
            <button type="button" onClick={() => setCustomer(null)} className="eyebrow text-gold-deep">
              {t.change}
            </button>
          </div>
        ) : creating ? (
          <div className="rounded-xl border border-border bg-white/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-xl">{t.newCustomer}</h3>
              <button type="button" aria-label={t.cancel} onClick={() => setCreating(false)} className="grid h-9 w-9 place-items-center rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
            <CustomerForm
              t={t.form}
              messages={messages}
              onDone={(c) => {
                setCustomer(c as PickedCustomer);
                setCreating(false);
              }}
            />
          </div>
        ) : (
          <>
            <CustomerSearch
              t={t.search}
              render={(c) => (
                <button type="button" onClick={() => setCustomer(c)} className="flex w-full items-center justify-between rounded-xl border border-border bg-white/70 px-4 py-3 text-left">
                  <span>
                    <span className="block">{c.company || c.name}</span>
                    <span className="text-xs text-ink/55">{[c.company ? c.name : null, c.phone].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              )}
            />
            <Button type="button" variant="outline" className="w-full" onClick={() => setCreating(true)}>
              {t.newCustomer}
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow text-ink/60">{t.items}</h2>
        <ScanField onScan={onScan} t={t.scan} busy={pending} />
        {results && (
          <ul className="space-y-2" aria-label={t.results}>
            {results.map((card) => (
              <li key={card.variant}>
                <button type="button" onClick={() => (add(card.variant), setResults(null))} className="flex w-full items-center justify-between rounded-xl border border-border bg-white/70 px-4 py-3 text-left">
                  <span>
                    <span className="block">{card.name}</span>
                    <span className="text-xs text-ink/55">{[card.label, card.sku].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="tabular-nums text-ink/70">{formatMoney(card.priceCents, locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink/55">{t.noItems}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-white/70">
            {lines.map((line, i) => {
              const q = quote?.lines.find((l) => l.variant === line.variant && (l.unit ?? undefined) === line.unit);
              const name = q ? [q.name, q.detail].filter(Boolean).join(' · ') : '…';
              return (
                <li key={`${line.variant}:${line.unit ?? ''}`} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block">{name}</span>
                    {q && <span className="text-xs text-ink/55">{formatMoney(q.unitPriceCents, locale)}</span>}
                  </span>
                  <button type="button" aria-label={line.qty === 1 ? t.remove : '−'} onClick={() => setQty(i, line.qty - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-border">
                    {line.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  </button>
                  <span className="w-7 text-center tabular-nums" aria-label={`${t.qty} ${name}`}>
                    {line.qty}
                  </span>
                  <button type="button" aria-label="+" onClick={() => setQty(i, line.qty + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-border">
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="w-20 text-right text-sm tabular-nums">{q ? formatMoney(q.totalCents, locale) : ''}</span>
                </li>
              );
            })}
          </ul>
        )}
        {quote && lines.length > 0 && (
          <dl className="space-y-1 rounded-xl bg-champagne/60 px-4 py-3 text-sm">
            {quote.vatBreakdown.map((v) => (
              <div key={v.rateBp} className="flex justify-between text-ink/60">
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
              className={`rounded-xl border p-3 text-left transition ${payment === value ? 'border-ink bg-ink text-bone' : 'border-border bg-white/70'}`}
            >
              <span className="block text-sm">{t[value]}</span>
              <span className={`text-xs ${payment === value ? 'text-bone/70' : 'text-ink/55'}`}>{t[`${value}Hint`]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2">
        <Button type="button" onClick={place} disabled={pending || lines.length === 0 || !quote} className="w-full shadow-lg">
          {pending ? t.placing : quote ? `${t.confirm} · ${formatMoney(quote.totalCents, locale)}` : t.confirm}
        </Button>
        {!customer && lines.length > 0 && <p className="mt-2 text-center text-xs text-ink/60">{t.needCustomer}</p>}
      </div>
    </div>
  );
}
