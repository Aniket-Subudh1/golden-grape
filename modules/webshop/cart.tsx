'use client';

import { createContext, type ReactNode, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Locale } from '@/lib/i18n';
import type { CartQuote } from '@/modules/promotions/service';
import { quoteCartAction } from './actions';

// The cart (05 §3.2): the browser keeps only what is in it, never a price. Every number shown comes from the server
// quote, refreshed 300 ms after each change; lines above the stock are clamped and the visitor is told.

export type CartMode = 'pickup' | 'delivery' | 'table';
/** How the basket itself is collected: the only mode the cart remembers. */
export type BasketMode = Exclude<CartMode, 'table'>;
export type CartItem = { variant: string; unit?: string; qty: number };

const STORAGE = 'gg_cart_v2';
const OLD_STORAGE = ['gg_cart_v1', 'gg-cart', 'cart']; // earlier versions held client prices: dropped

type CartContext = {
  /** The saved cart has been read (before that, `items` is empty because it is not known yet). */
  ready: boolean;
  items: CartItem[];
  /** Pickup or delivery for the basket, remembered between visits. A table booking is never remembered: it is
   *  chosen each time (APPLUX audit 10 Nov, §1/§3), through `openAs('table')` or a `?mode=table` link. */
  mode: BasketMode;
  /** The view the drawer was opened in (`openAs`), until it closes. */
  openMode: CartMode | null;
  open: boolean;
  count: number;
  quote: CartQuote | null;
  pending: boolean;
  setOpen: (open: boolean) => void;
  openAs: (mode: CartMode) => void;
  setMode: (mode: BasketMode) => void;
  qtyOf: (variant: string, unit?: string) => number;
  add: (item: { variant: string; unit?: string }, qty?: number) => void;
  setQty: (item: { variant: string; unit?: string }, qty: number) => void;
  /** Takes these lines out (a table's pre-ordered dishes once booked; the shop items stay). */
  remove: (targets: { variant: string; unit?: string }[]) => void;
  /** Empties the cart (after an order is placed). */
  clear: () => void;
  /** Asks the server again (checkout was told the stock changed). */
  refresh: () => void;
};

const Context = createContext<CartContext | null>(null);

const noSubscribe = () => () => {};

/**
 * The cart for a component. While that component hydrates it sees an empty cart, exactly what the server rendered
 * (the server never knows the saved cart); right after, the real one. Without this, parts that stream in later (the
 * nav, product cards) would hydrate against a cart already restored from localStorage and fail to match.
 */
export function useCart(): CartContext {
  const cart = useContext(Context);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!cart) throw new Error('useCart outside CartProvider');
  return hydrated ? cart : { ...cart, ready: false, items: [], count: 0, quote: null, qtyOf: () => 0 };
}

const same = (a: { variant: string; unit?: string }, b: { variant: string; unit?: string }) => a.variant === b.variant && (a.unit ?? '') === (b.unit ?? '');

function read(): { items: CartItem[]; mode: BasketMode } {
  try {
    for (const key of OLD_STORAGE) localStorage.removeItem(key);
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as { items?: unknown; mode?: unknown } | null;
    const items = Array.isArray(saved?.items)
      ? saved.items.filter(
          (i): i is CartItem => typeof i?.variant === 'string' && Number.isInteger(i?.qty) && i.qty > 0 && (i.unit === undefined || typeof i.unit === 'string'),
        )
      : [];
    // A table saved by an earlier version is not restored: the next visit starts as an ordinary basket.
    const mode = saved?.mode === 'delivery' ? 'delivery' : 'pickup';
    return { items: items.map(({ variant, unit, qty }) => ({ variant, unit, qty })), mode };
  } catch {
    // Private mode or a corrupt value: start with an empty cart (the one allowed empty catch, 03 law 13).
    return { items: [], mode: 'pickup' };
  }
}

export function CartProvider({ locale, notices, children }: { locale: Locale; notices: { clamped: string; removed: string }; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<BasketMode>('pickup');
  const [openMode, setOpenMode] = useState<CartMode | null>(null);
  const [open, setOpenState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [pending, setPending] = useState(false);
  const [asked, setAsked] = useState(0);
  const request = useRef(0);
  // The first quote after loading is asked at once (the drawer has no lines to show until it arrives); later
  // changes wait 300 ms so a stepper clicked five times asks once.
  const quotedOnce = useRef(false);

  useEffect(() => {
    const saved = read();
    // Restoring the saved cart after hydration: the server render never knows it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(saved.items);
    setMode(saved.mode);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ items, mode }));
    } catch {
      // Storage full or disabled: the cart still works for this visit (03 law 13).
    }
  }, [items, mode, loaded]);

  // Server quote, 300 ms after the last change (at once the first time). Only the latest answer is applied.
  useEffect(() => {
    if (!loaded) return;
    const id = ++request.current;
    if (items.length === 0) {
      startTransition(() => setQuote(null));
      return;
    }
    const delay = quotedOnce.current ? 300 : 0;
    quotedOnce.current = true;
    const timer = window.setTimeout(async () => {
      setPending(true);
      const result = await quoteCartAction(null, { locale, lines: items });
      if (id !== request.current) return;
      setPending(false);
      if (!result.ok) return;
      setQuote(result.data);
      if (result.data.notices.length > 0) {
        setItems((current) =>
          current
            .map((item) => {
              const notice = result.data.notices.find((n) => same(n, item));
              return notice ? { ...item, qty: notice.kind === 'removed' ? 0 : notice.qty } : item;
            })
            .filter((item) => item.qty > 0),
        );
        toast.warning(result.data.notices.some((n) => n.kind === 'removed') ? notices.removed : notices.clamped);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [items, loaded, locale, notices, asked]);

  const setQty = useCallback((target: { variant: string; unit?: string }, qty: number) => {
    setItems((current) => {
      const exists = current.some((i) => same(i, target));
      if (qty <= 0) return current.filter((i) => !same(i, target));
      return exists ? current.map((i) => (same(i, target) ? { ...i, qty } : i)) : [...current, { variant: target.variant, unit: target.unit, qty }];
    });
  }, []);

  // Closing the drawer forgets the view it was opened in, so a table chosen once never sticks to the basket.
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setOpenMode(null);
  }, []);

  const value = useMemo<CartContext>(
    () => ({
      ready: loaded,
      items,
      mode,
      openMode,
      open,
      quote,
      pending,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      setOpen,
      setMode,
      openAs: (m) => {
        if (m === 'table') setOpenMode('table');
        else {
          setMode(m);
          setOpenMode(null);
        }
        setOpenState(true);
      },
      qtyOf: (variant, unit) => items.find((i) => same(i, { variant, unit }))?.qty ?? 0,
      add: (target, qty = 1) => setQty(target, (items.find((i) => same(i, target))?.qty ?? 0) + qty),
      setQty,
      remove: (targets) => setItems((current) => current.filter((i) => !targets.some((t) => same(t, i)))),
      clear: () => setItems([]),
      refresh: () => setAsked((n) => n + 1),
    }),
    [loaded, items, mode, openMode, open, quote, pending, setQty, setOpen],
  );

  return <Context value={value}>{children}</Context>;
}
