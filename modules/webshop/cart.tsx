'use client';

import { createContext, type ReactNode, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Locale } from '@/lib/i18n';
import type { CartQuote } from '@/modules/promotions/service';
import { quoteCartAction } from './actions';

// The cart (05 §3.2): the browser keeps only what is in it, never a price. Every number shown comes from the server
// quote, refreshed 300 ms after each change; lines above the stock are clamped and the visitor is told.

export type CartMode = 'pickup' | 'delivery' | 'table';
export type CartItem = { variant: string; unit?: string; qty: number };

const STORAGE = 'gg_cart_v2';
const OLD_STORAGE = ['gg_cart_v1', 'gg-cart', 'cart']; // earlier versions held client prices: dropped

type CartContext = {
  /** The saved cart has been read (before that, `items` is empty because it is not known yet). */
  ready: boolean;
  items: CartItem[];
  mode: CartMode;
  open: boolean;
  count: number;
  quote: CartQuote | null;
  pending: boolean;
  setOpen: (open: boolean) => void;
  openAs: (mode: CartMode) => void;
  setMode: (mode: CartMode) => void;
  qtyOf: (variant: string, unit?: string) => number;
  add: (item: { variant: string; unit?: string }, qty?: number) => void;
  setQty: (item: { variant: string; unit?: string }, qty: number) => void;
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

function read(): { items: CartItem[]; mode: CartMode } {
  try {
    for (const key of OLD_STORAGE) localStorage.removeItem(key);
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as { items?: unknown; mode?: unknown } | null;
    const items = Array.isArray(saved?.items)
      ? saved.items.filter(
          (i): i is CartItem => typeof i?.variant === 'string' && Number.isInteger(i?.qty) && i.qty > 0 && (i.unit === undefined || typeof i.unit === 'string'),
        )
      : [];
    const mode = saved?.mode === 'delivery' || saved?.mode === 'table' ? saved.mode : 'pickup';
    return { items: items.map(({ variant, unit, qty }) => ({ variant, unit, qty })), mode };
  } catch {
    // Private mode or a corrupt value: start with an empty cart (the one allowed empty catch, 03 law 13).
    return { items: [], mode: 'pickup' };
  }
}

export function CartProvider({ locale, notices, children }: { locale: Locale; notices: { clamped: string; removed: string }; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<CartMode>('pickup');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [pending, setPending] = useState(false);
  const [asked, setAsked] = useState(0);
  const request = useRef(0);

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

  // Server quote, 300 ms after the last change. Only the latest answer is applied.
  useEffect(() => {
    if (!loaded) return;
    const id = ++request.current;
    if (items.length === 0) {
      startTransition(() => setQuote(null));
      return;
    }
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
    }, 300);
    return () => window.clearTimeout(timer);
  }, [items, loaded, locale, notices, asked]);

  const setQty = useCallback((target: { variant: string; unit?: string }, qty: number) => {
    setItems((current) => {
      const exists = current.some((i) => same(i, target));
      if (qty <= 0) return current.filter((i) => !same(i, target));
      return exists ? current.map((i) => (same(i, target) ? { ...i, qty } : i)) : [...current, { variant: target.variant, unit: target.unit, qty }];
    });
  }, []);

  const value = useMemo<CartContext>(
    () => ({
      ready: loaded,
      items,
      mode,
      open,
      quote,
      pending,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      setOpen,
      setMode,
      openAs: (m) => {
        setMode(m);
        setOpen(true);
      },
      qtyOf: (variant, unit) => items.find((i) => same(i, { variant, unit }))?.qty ?? 0,
      add: (target, qty = 1) => setQty(target, (items.find((i) => same(i, target))?.qty ?? 0) + qty),
      setQty,
      clear: () => setItems([]),
      refresh: () => setAsked((n) => n + 1),
    }),
    [loaded, items, mode, open, quote, pending, setQty],
  );

  return <Context value={value}>{children}</Context>;
}
