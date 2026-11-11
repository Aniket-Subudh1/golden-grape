'use client';

import { Bike, Info, Landmark, MapPin, ShoppingBag, Store, TriangleAlert, UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QtyStepper } from '@/components/site/qty-stepper';
import { ActionForm, SubmitButton, useFieldError } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { type Dictionary, interpolate, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { isPhone } from '@/lib/phone';
import { slotLabel } from '@/lib/time';
import { checkoutQuote, placeOrderAction, slotsFor } from '@/modules/sales/actions';
import { localityAction, suggestAddressAction } from '../actions';
import type { AddressSuggestion } from '../address';
import { PAYMENT_CHOICES, type PaymentChoice } from '@/modules/sales/order-states';
import type { SlotDay } from '@/modules/sales/service';
import { type CartMode, useCart } from '../cart';
import { CallUs, SlotPicker } from './slot-picker';

// The checkout (M2.3 T5): one page for pickup, delivery and a table with an optional pre-order, on one slot engine.
// Every number comes from the server (checkoutQuote); the order is placed by placeOrderAction with an idempotency key
// kept in sessionStorage, so a reload or a double click never places it twice.

type Address = { line1: string; line2?: string | null; postalCode: string; city: string };

export type CheckoutCustomer = {
  name: string;
  email: string;
  phone?: string | null;
  /** The default address, filled in first. */
  address?: Address | null;
  /** Every saved address, to pick from (GG-010). */
  addresses?: (Address & { id: string; label?: string | null })[];
} | null;

type Props = {
  locale: Locale;
  initialMode: CartMode | null;
  customer: CheckoutCustomer;
  t: Dictionary['checkout'];
  cartT: Pick<Dictionary['cart'], 'modes' | 'hints' | 'minus' | 'plus' | 'toShop' | 'toCounter' | 'vatIncluded' | 'tableShopNote'>;
  formT: Dictionary['form'];
  signInHref: string;
  /** The shop's phone (Shop details), offered when nothing can be booked online. */
  phone?: string | null;
};

type Summary = Extract<Awaited<ReturnType<typeof checkoutQuote>>, { ok: true }>['data'];

const MODES: { id: CartMode; icon: typeof ShoppingBag }[] = [
  { id: 'pickup', icon: ShoppingBag },
  { id: 'delivery', icon: Bike },
  { id: 'table', icon: UtensilsCrossed },
];

const KEY = 'gg_checkout_key';
const percent = (bp: number, locale: Locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);

/** One key per checkout: created when the page opens, kept across reloads, replaced once an order is placed. */
function useIdempotencyKey() {
  const [key, setKey] = useState('');
  useEffect(() => {
    let saved = '';
    try {
      saved = sessionStorage.getItem(KEY) ?? '';
      if (!saved) sessionStorage.setItem(KEY, (saved = crypto.randomUUID()));
    } catch {
      saved = crypto.randomUUID(); // storage disabled: this visit still gets one key (03 law 13)
    }
    // The key exists only in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(saved);
  }, []);
  const renew = () => {
    const next = crypto.randomUUID();
    try {
      sessionStorage.setItem(KEY, next);
    } catch {
      // see above
    }
    setKey(next);
  };
  return [key, renew] as const;
}

function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-border/70 pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-4 font-serif text-2xl md:text-3xl">
          <span className="font-sans text-[11px] tracking-[0.3em] text-gold-deep tabular-nums">{String(n).padStart(2, '0')}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  const Icon = tone === 'warning' ? TriangleAlert : Info;
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-4 text-sm', tone === 'warning' ? 'border-gold-deep/40 bg-gold/10 text-ink' : 'border-border/70 bg-champagne/40 text-ink/70')}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function LinesError() {
  const error = useFieldError('lines');
  return error ? (
    <p className="text-xs text-red-700" role="alert">
      {error}
    </p>
  ) : null;
}

/** The same rule as the server's `z.email` for what can be typed here: something@domain.tld. */
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const sameAddress = (a: Address, b: Address) => a.line1.trim() === b.line1.trim() && a.postalCode.trim() === b.postalCode.trim();

/**
 * Street and number with official Luxembourg suggestions (GG-007): typing 3 characters or more asks the server
 * (Geoportail), picking one fills street, postcode and town. Nothing is forced: the fields stay editable.
 */
function StreetField({ value, onChange, onPick, label, t }: { value: string; onChange: (v: string) => void; onPick: (a: AddressSuggestion) => void; label: string; t: Dictionary['checkout']['address'] }) {
  const [focused, setFocused] = useState(false);
  const [found, setFound] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  // The street just picked: no new search until the customer types again.
  const [picked, setPicked] = useState('');
  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 3 || query === picked) return;
    let stale = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const result = await suggestAddressAction(null, { query });
      if (stale) return;
      setSearching(false);
      setFound(result.ok ? result.data : []);
    }, 300);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [value, focused, picked]);
  const open = focused && value.trim().length >= 3 && value.trim() !== picked && (found.length > 0 || searching);
  return (
    <div className="relative sm:col-span-2" onFocus={() => setFocused(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}>
      <Field name="line1" label={label} autoComplete="address-line1" value={value} onChange={(e) => onChange(e.target.value)} required aria-autocomplete="list" aria-expanded={open} />
      {open && (
        <ul role="listbox" aria-label={t.pick} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-bone py-1 shadow-lg">
          {searching && found.length === 0 && <li className="px-4 py-2 text-xs text-ink/50">{t.searching}</li>}
          {found.map((a) => (
            <li key={`${a.line1}-${a.postalCode}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-start gap-3 px-4 py-2 text-left text-sm hover:bg-champagne/60 focus:bg-champagne/60 focus:outline-none"
                onClick={() => {
                  setPicked(a.line1);
                  setFound([]);
                  onPick(a);
                }}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" />
                <span>
                  {a.line1}
                  <span className="block text-xs text-ink/50">
                    L-{a.postalCode} {a.city}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CheckoutForm({ locale, initialMode, customer, t, cartT, formT, signInHref, phone }: Props) {
  const router = useRouter();
  const cart = useCart();
  const { items, ready } = cart;
  // The checkout's own mode (APPLUX audit 10 Nov, §1/§3): the one the link asked for (`?mode=table`), else the
  // basket's pickup or delivery. Choosing pickup or delivery here also becomes the basket's mode; a table never does,
  // so a booking never turns a later shop purchase into a table.
  const [picked, setPicked] = useState<CartMode | null>(initialMode);
  const mode: CartMode = picked ?? cart.mode;
  const setMode = (m: CartMode) => {
    setPicked(m);
    if (m !== 'table') cart.setMode(m);
  };
  const [key, renewKey] = useIdempotencyKey();
  const [days, setDays] = useState<Partial<Record<CartMode, SlotDay[]>>>({});
  const [slot, setSlot] = useState({ date: '', time: '' });
  const [guests, setGuests] = useState(2);
  // Off until the customer asks for it: a table is a booking first (§1, workflow C).
  const [preorder, setPreorder] = useState(false);
  const [contact, setContact] = useState({ name: customer?.name ?? '', email: customer?.email ?? '', phone: customer?.phone ?? '' });
  const start = customer?.address;
  // `cityFromCode`: the town was filled from the postcode (GG-007), so a new postcode may replace it; typed by hand, never.
  const [addr, setAddr] = useState({ line1: start?.line1 ?? '', line2: start?.line2 ?? '', postalCode: start?.postalCode ?? '', city: start?.city ?? '', cityFromCode: false });
  const [keepAddress, setKeepAddress] = useState(true);
  const postalCode = addr.postalCode;
  const saved = customer?.addresses ?? [];
  const savedMatch = saved.find((a) => sameAddress(a, addr)) ?? null;
  const [choice, setChoice] = useState<PaymentChoice>('onsite');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pricing, setPricing] = useState(false);
  const asked = useRef(0);
  const money = (cents: number) => formatMoney(cents, locale);

  const loadDays = (m: CartMode) =>
    slotsFor(null, { mode: m }).then((r) => {
      if (!r.ok) return;
      setDays((d) => ({ ...d, [m]: r.data }));
      // Each mode has its own calendar: keep the chosen time only if it is still free, else start on the first open day.
      setSlot((s) => {
        const day = r.data.find((d) => d.date === s.date);
        if (day?.slots.some((x) => x.from === s.time && x.available > 0)) return s;
        const first = r.data.find((d) => d.slots.some((x) => x.available > 0));
        return { date: day ? s.date : (first?.date ?? ''), time: '' };
      });
    });

  useEffect(() => {
    // Reload when the mode changes; a failed submit reloads explicitly.
    void loadDays(mode);
    // A page left open must not offer times that have passed or filled up meanwhile (GG-009): fresh every minute and
    // when the customer comes back to the tab. The server checks again when the order is placed.
    const tick = () => {
      if (document.visibilityState === 'visible') void loadDays(mode);
    };
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [mode]);

  // The town from a Luxembourg postcode (GG-007), only while the town is empty or was filled this way.
  useEffect(() => {
    if (mode !== 'delivery' || !/^\s*(L[\s-]*)?\d{4}\s*$/i.test(postalCode)) return;
    let stale = false;
    const timer = window.setTimeout(async () => {
      const result = await localityAction(null, { postalCode });
      if (stale || !result.ok || !result.data) return;
      const town = result.data;
      setAddr((a) => (a.city.trim() && !a.cityFromCode ? a : { ...a, city: town, cityFromCode: true }));
    }, 350);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [postalCode, mode]);

  // A table's pre-order holds only the counter's dishes and drinks (§1, §6); shop items stay in the basket for a
  // pickup or delivery order. The server checks the same rule. With nothing from the counter, the table is booked
  // without a pre-order (GG-039): never a blocked button because of the switch.
  const counterKeys = new Set((cart.quote?.lines ?? []).filter((l) => l.kind === 'snack').map((l) => `${l.variant}:${l.unit ?? ''}`));
  const preorderItems = items.filter((i) => counterKeys.has(`${i.variant}:${i.unit ?? ''}`));
  const shopItemsAtTable = mode === 'table' && items.length > preorderItems.length;
  const canPreorder = preorderItems.length > 0;
  const withPreorder = preorder && canPreorder;
  const withLines = mode !== 'table' || withPreorder;
  const lines = mode === 'table' ? (withPreorder ? preorderItems : []) : items;

  // Server totals for what will be ordered, with the delivery fee of the postcode typed (300 ms after the last change).
  useEffect(() => {
    if (!ready) return;
    const id = ++asked.current;
    const timer = window.setTimeout(async () => {
      setPricing(true);
      const result = await checkoutQuote(null, { locale, mode, lines, postalCode: mode === 'delivery' ? postalCode : undefined });
      if (id !== asked.current) return;
      setPricing(false);
      if (result.ok) setSummary(result.data);
    }, 300);
    return () => window.clearTimeout(timer);
    // `lines` is derived from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, items, mode, preorder, postalCode, locale, cart.quote]);

  const payments = PAYMENT_CHOICES[mode];
  const payment = payments.includes(choice) ? choice : payments[0];
  const quote = summary?.quote ?? null;
  const zone = mode === 'delivery' ? (summary?.zone ?? null) : null;
  const outside = mode === 'delivery' && Boolean(summary?.outside);

  const submit: typeof placeOrderAction = async (prev, data) => {
    const result = await placeOrderAction(prev, data);
    if (!result.ok) {
      const field = Object.keys(result.fieldErrors ?? {});
      if (field.some((f) => f === 'slot' || f === 'time' || f === 'date')) void loadDays(mode);
      if (field.includes('lines')) cart.refresh();
    }
    return result;
  };

  // The heading follows the mode: a table booking reads "Réservation · Votre table", not "Votre commande" (APPLUX §3).
  const asTable = (ready ? mode : (initialMode ?? mode)) === 'table';
  const heading = (
    <header className="mb-12 md:mb-16">
      <p className="eyebrow mb-4 text-gold-deep">{asTable ? t.eyebrowTable : t.eyebrow}</p>
      <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">{asTable ? t.titleTable : t.title}</h1>
    </header>
  );

  if (!ready) {
    return (
      <>
        {heading}
        <div className="min-h-[60vh]" aria-busy />
      </>
    );
  }

  if (withLines && items.length === 0 && mode !== 'table') {
    return (
      <>
        {heading}
        <div className="mx-auto flex max-w-xl flex-col items-center border border-border/70 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/15">
            <ShoppingBag className="h-6 w-6 text-gold-deep" />
          </span>
          <h2 className="mt-6 font-serif text-3xl">{t.emptyTitle}</h2>
          <p className="mt-3 max-w-sm text-sm text-ink/60">{t.emptyText}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={localePath(locale, '/shop')}>{cartT.toShop}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={localePath(locale, '/snack')}>{cartT.toCounter}</Link>
            </Button>
            <Button variant="gold" onClick={() => setMode('table')}>
              {t.bookTable}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // What still stops the order (GG-006): the same checks as the server, so the button only works when it can succeed.
  // Loaded, and not one free time in the whole window (GG-022): the order cannot be placed online at all.
  const noSlots = Boolean(days[mode]) && !days[mode]!.some((d) => d.slots.some((s) => s.available > 0));
  const missing = [
    !slot.time && !noSlots && t.check.time,
    !contact.name.trim() && t.check.name,
    !isEmail(contact.email) && t.check.email,
    !isPhone(contact.phone.trim()) && t.check.phone,
    ...(mode === 'delivery' ? [!addr.line1.trim() && t.check.line1, !addr.postalCode.trim() && t.check.postalCode, !addr.city.trim() && t.check.city] : []),
  ].filter((m): m is string => Boolean(m));
  const blockers = [
    noSlots ? t.noSlots : null,
    withLines && lines.length === 0 ? t.preorder.empty : null,
    outside ? t.zone.outside : null,
    zone?.belowMinimum ? interpolate(t.zone.belowMin, { missing: money(zone.minOrderCents - (quote?.subtotalCents ?? 0)), min: money(zone.minOrderCents) }) : null,
    missing.length > 0 ? interpolate(t.missing, { fields: missing.join(', ') }) : null,
  ].filter((b): b is string => Boolean(b));
  const req = (label: string) => `${label} *`;

  let n = 0;
  return (
    <>
      {heading}
      <ActionForm
        action={submit}
        messages={formT}
        keepValues
        onSuccess={(data) => {
          if (!data.id) return;
          // A table takes only its pre-ordered dishes out of the basket; an order takes everything.
          if (mode !== 'table') cart.clear();
          else if (withPreorder) cart.remove(preorderItems);
          renewKey();
          router.push(`${localePath(locale, `/order/${data.id}`)}?t=${data.token}`);
        }}
        className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16"
      >
        <input type="hidden" name="idempotencyKey" value={key} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="lines" value={JSON.stringify(lines.map(({ variant, unit, qty }) => ({ variant, unit, qty })))} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="payment" value={payment} />
        {mode === 'table' && <input type="hidden" name="guests" value={guests} />}
        {mode === 'table' && withPreorder && <input type="hidden" name="preorder" value="on" />}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        <div className="min-w-0 space-y-12">
          <Step n={++n} title={t.steps.mode}>
            <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label={t.steps.mode}>
              {MODES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  onClick={() => setMode(id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border px-2 py-5 text-center transition sm:items-start sm:px-5 sm:text-left',
                    mode === id ? 'border-ink bg-ink text-bone' : 'border-border bg-bone hover:border-ink',
                  )}
                >
                  <Icon className={cn('h-5 w-5', mode === id ? 'text-gold' : 'text-gold-deep')} />
                  <span className="text-[11px] tracking-[0.22em] uppercase">{cartT.modes[id]}</span>
                  <span className={cn('hidden text-xs leading-snug sm:block', mode === id ? 'text-bone/70' : 'text-ink/50')}>{cartT.hints[id]}</span>
                </button>
              ))}
            </div>
          </Step>

          {mode === 'table' && (
            <Step n={++n} title={t.steps.guests}>
              <div className="space-y-6">
                <QtyStepper value={guests} onChange={setGuests} min={1} max={20} labels={{ minus: cartT.minus, plus: cartT.plus }} />
                <button
                  type="button"
                  role="switch"
                  aria-checked={withPreorder}
                  disabled={!canPreorder}
                  onClick={() => setPreorder((p) => !p)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border/70 p-4 text-left transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border/70"
                >
                  <span>
                    <span className="block text-sm font-medium">{t.preorder.label}</span>
                    <span className="mt-0.5 block text-xs text-ink/55">{t.preorder.hint}</span>
                  </span>
                  <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition', withPreorder ? 'bg-ink' : 'bg-border')}>
                    <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-bone shadow transition-all', withPreorder ? 'left-6' : 'left-1')} />
                  </span>
                </button>
                {!canPreorder && (
                  <Notice>
                    {t.preorder.empty}{' '}
                    <Link href={localePath(locale, '/snack')} className="border-b border-gold-deep text-gold-deep">
                      {t.preorder.toCounter}
                    </Link>
                  </Notice>
                )}
                {shopItemsAtTable && <Notice>{cartT.tableShopNote}</Notice>}
              </div>
            </Step>
          )}

          <Step n={++n} title={t.steps.when}>
            <SlotPicker days={days[mode] ?? null} value={slot} onChange={setSlot} locale={locale} t={t} phone={phone} />
          </Step>

          {mode === 'delivery' && (
            <Step n={++n} title={t.steps.address}>
              {saved.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-label={t.address.saved}>
                  {saved.map((a) => (
                    <Button
                      key={a.id}
                      type="button"
                      variant="chip"
                      size="sm"
                      role="radio"
                      aria-checked={savedMatch?.id === a.id}
                      active={savedMatch?.id === a.id}
                      onClick={() => setAddr({ line1: a.line1, line2: a.line2 ?? '', postalCode: a.postalCode, city: a.city, cityFromCode: false })}
                    >
                      {a.label || a.line1}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="chip"
                    size="sm"
                    role="radio"
                    aria-checked={!savedMatch}
                    active={!savedMatch}
                    onClick={() => setAddr({ line1: '', line2: '', postalCode: '', city: '', cityFromCode: false })}
                  >
                    {t.address.other}
                  </Button>
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2">
                <StreetField
                  value={addr.line1}
                  onChange={(line1) => setAddr((a) => ({ ...a, line1 }))}
                  onPick={(found) => setAddr((a) => ({ ...a, ...found, cityFromCode: false }))}
                  label={req(t.fields.line1)}
                  t={t.address}
                />
                <Field name="line2" label={t.fields.line2} autoComplete="address-line2" value={addr.line2} onChange={(e) => setAddr((a) => ({ ...a, line2: e.target.value }))} className="sm:col-span-2" />
                <Field name="postalCode" label={req(t.fields.postalCode)} autoComplete="postal-code" inputMode="numeric" value={addr.postalCode} onChange={(e) => setAddr((a) => ({ ...a, postalCode: e.target.value }))} placeholder="L-7795" required />
                <div>
                  <Field
                    name="city"
                    label={req(t.fields.city)}
                    autoComplete="address-level2"
                    value={addr.city}
                    onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value, cityFromCode: false }))}
                    required
                  />
                  {addr.cityFromCode && <p className="mt-1 text-xs text-ink/50">{t.address.cityFound}</p>}
                </div>
              </div>
              <p className="mt-3 text-xs text-ink/50">{t.address.hint}</p>
              {customer && !savedMatch && (
                <label className="mt-4 flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={keepAddress} onChange={(e) => setKeepAddress(e.target.checked)} className="h-4 w-4 accent-ink" />
                  {t.address.save}
                </label>
              )}
              {customer && !savedMatch && keepAddress && <input type="hidden" name="saveAddress" value="on" />}
              <div className="mt-6">
                {!postalCode.trim() ? (
                  <Notice>{t.zone.enterCode}</Notice>
                ) : outside ? (
                  <Notice tone="warning">
                    <p>{t.zone.outside}</p>
                    <button type="button" onClick={() => setMode('pickup')} className="mt-2 border-b border-gold-deep text-[11px] tracking-[0.22em] text-gold-deep uppercase">
                      {t.zone.choosePickup}
                    </button>
                  </Notice>
                ) : zone ? (
                  <Notice tone={zone.belowMinimum ? 'warning' : 'info'}>
                    <p>
                      {[
                        quote?.deliveryCents === 0 && quote.lines.length > 0 ? t.zone.freeNow : interpolate(t.zone.fee, { fee: money(zone.feeCents) }),
                        zone.minOrderCents > 0 && interpolate(t.zone.min, { min: money(zone.minOrderCents) }),
                        zone.freeFromCents != null && interpolate(t.zone.free, { free: money(zone.freeFromCents) }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {zone.belowMinimum && (
                      <p className="mt-1 font-medium">
                        {interpolate(t.zone.belowMin, { missing: money(zone.minOrderCents - (quote?.subtotalCents ?? 0)), min: money(zone.minOrderCents) })}
                      </p>
                    )}
                  </Notice>
                ) : null}
              </div>
            </Step>
          )}

          <Step
            n={++n}
            title={t.steps.details}
            aside={
              !customer && (
                <p className="hidden text-xs text-ink/55 sm:block">
                  {t.signedOut}{' '}
                  <Link href={signInHref} className="border-b border-gold-deep text-gold-deep">
                    {t.signIn}
                  </Link>
                </p>
              )
            }
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field name="name" label={req(t.fields.name)} autoComplete="name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} required className="sm:col-span-2" />
              <Field name="email" type="email" label={req(t.fields.email)} autoComplete="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} required />
              <Field name="phone" type="tel" label={req(t.fields.phone)} autoComplete="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} required placeholder="+352 …" />
              <Field as="textarea" name="notes" label={t.fields.notes} placeholder={t.fields.notesPh} className="sm:col-span-2" />
            </div>
            <p className="mt-4 text-xs text-ink/50">{t.requiredNote}</p>
            {!customer && (
              <p className="mt-6 text-xs text-ink/55 sm:hidden">
                {t.signedOut}{' '}
                <Link href={signInHref} className="border-b border-gold-deep text-gold-deep">
                  {t.signIn}
                </Link>{' '}
                {t.signInHint}
              </p>
            )}
          </Step>

          <Step n={++n} title={t.steps.payment}>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.steps.payment}>
              {payments.map((p) => {
                const Icon = p === 'transfer' ? Landmark : Store;
                const title = p === 'transfer' ? t.payment.transfer : mode === 'table' ? t.payment.onsiteTable : t.payment.onsite;
                const hint = p === 'transfer' ? t.payment.transferHint : mode === 'table' ? t.payment.onsiteTableHint : t.payment.onsiteHint;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={payment === p}
                    onClick={() => setChoice(p)}
                    className={cn('flex items-start gap-4 rounded-2xl border p-5 text-left transition', payment === p ? 'border-ink bg-bone shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-border hover:border-ink')}
                  >
                    <span className={cn('mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border', payment === p ? 'border-ink' : 'border-border')}>
                      {payment === p && <span className="h-2 w-2 rounded-full bg-ink" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-gold-deep" /> {title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-ink/55">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>
        </div>

        <aside className="min-w-0">
          <div className="space-y-6 border border-border/70 bg-champagne/30 p-6 md:p-8 lg:sticky lg:top-28">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow text-gold-deep">{t.summary}</span>
              {lines.length > 0 && (
                <button type="button" onClick={() => cart.setOpen(true)} className="eyebrow text-ink/50 hover:text-gold-deep">
                  {t.editBag}
                </button>
              )}
            </div>

            {mode === 'table' && (
              <div>
                <p className="font-serif text-2xl">{interpolate(t.reservation, { count: guests })}</p>
                {!withPreorder && <p className="mt-1 text-xs text-ink/55">{t.noPreorder}</p>}
              </div>
            )}

            {quote && quote.lines.length > 0 && (
              <ul className={cn('space-y-4 transition-opacity', pricing && 'opacity-60')}>
                {quote.lines.map((l) => (
                  <li key={`${l.variant}:${l.unit ?? ''}`} className="flex items-center gap-3">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-champagne">
                      {l.image && <Image src={l.image} alt="" fill sizes="48px" className="object-cover" />}
                      <span className="absolute -top-0 -right-0 grid h-5 min-w-5 place-items-center rounded-bl-md bg-ink px-1 text-[10px] text-bone tabular-nums">{l.qty}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{l.name}</span>
                      {l.detail && <span className="block truncate text-xs text-ink/50">{l.detail}</span>}
                    </span>
                    <span className="text-sm tabular-nums">{money(l.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="space-y-2 border-t border-border/70 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">{t.when}</dt>
                <dd className="text-right">{slot.time ? slotLabel({ date: slot.date, from: slot.time }, locale, 'short') : <span className="text-ink/40">{t.toChoose}</span>}</dd>
              </div>
              {quote && quote.lines.length > 0 && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/60">{t.subtotal}</dt>
                    <dd className="tabular-nums">{money(quote.subtotalCents)}</dd>
                  </div>
                  {mode === 'delivery' && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink/60">{t.delivery}</dt>
                      <dd className="tabular-nums">{zone ? (quote.deliveryCents ? money(quote.deliveryCents) : t.free) : <span className="text-ink/40">{t.toChoose}</span>}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>

            {quote && quote.lines.length > 0 && (
              <div className="border-t border-border/70 pt-5">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-ink/60">{t.total}</span>
                  <span className="font-serif text-3xl tabular-nums">{money(quote.totalCents)}</span>
                </div>
                <dl className="mt-2 space-y-0.5 text-[11px] text-ink/50">
                  {quote.vatBreakdown.map((v) => (
                    <div key={v.rateBp} className="flex justify-between">
                      <dt>{interpolate(cartT.vatIncluded, { rate: percent(v.rateBp, locale) })}</dt>
                      <dd className="tabular-nums">{money(v.vatCents)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <LinesError />
            {blockers.map((b) => (
              <p key={b} className="flex items-start gap-2 text-xs text-ink/70" role="status">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" />
                {b}
              </p>
            ))}
            {noSlots && phone && <CallUs phone={phone} />}
            <SubmitButton label={mode === 'table' ? t.submitTable : t.submit} pendingLabel={t.sending} className="w-full" disabled={blockers.length > 0 || !key || pricing} />
            <p className="text-center text-[11px] leading-relaxed text-ink/45">{t.footnote}</p>
          </div>
        </aside>
      </ActionForm>
    </>
  );
}
