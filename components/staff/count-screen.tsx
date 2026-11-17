'use client';

import { Check, CloudOff, Loader2, Minus, Plus, ScanBarcode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { interpolate } from '@/lib/i18n';
import { lookupBarcode } from '@/modules/catalogue/actions';
import { postStockCount, saveStockCountLines } from '@/modules/inventory/actions';
import { ScanField, type ScanTexts } from './scan-field';
import { Empty } from './tabs';

type Line = { variant: string; name: string; counted: number };
type Texts = {
  scan: ScanTexts;
  empty: string;
  notFound: string;
  untracked: string;
  added: string;
  saving: string;
  saved: string;
  saveError: string;
  post: string;
  posting: string;
  confirm: string;
  confirmTitle: string;
  cancel: string;
  posted: string;
  postError: string;
  emptyCount: string;
  closed: string;
  qty: string;
  items: string;
  units: string;
  hint: string;
};

/**
 * An open stock count on the phone (M3.1 T3). Each scan adds one bottle, or one box × its factor when the box's own
 * barcode was scanned; quantities can be typed. Lines are saved to the server shortly after every change, so a lost
 * connection loses at most the last entry. "Post" runs the same postCount as the admin.
 */
export function CountScreen({ id, initial, t }: { id: string; initial: Line[]; t: Texts }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial);
  const [state, setState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const dirty = useRef(false);

  // Debounced save of the whole list after each change (the server keeps one line per size).
  useEffect(() => {
    if (!dirty.current) return;
    setState('saving');
    const timer = setTimeout(async () => {
      const result = await saveStockCountLines(null, {
        count: id,
        lines: lines.map(({ variant, counted }) => ({ variant, counted })),
      });
      if (result.ok) setState('saved');
      else {
        setState('error');
        if (result.error === 'CONFLICT') {
          toast.error(t.closed);
          router.replace('/staff/count');
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [lines, id, router, t.closed]);

  const change = (update: (prev: Line[]) => Line[]) => {
    dirty.current = true;
    setLines(update);
  };

  const onScan = async (code: string) => {
    const hit = await lookupBarcode(null, { code });
    if (!hit.ok) return void toast.error(interpolate(t.notFound, { code }));
    const { card, factor } = hit.data;
    if (!card.trackStock) return void toast.error(t.untracked);
    navigator.vibrate?.(40);
    toast.success(interpolate(t.added, { qty: factor, name: card.name }));
    change((prev) => {
      const found = prev.find((l) => l.variant === card.variant);
      if (found) return [{ ...found, counted: found.counted + factor }, ...prev.filter((l) => l !== found)];
      return [
        { variant: card.variant, name: [card.name, card.label].filter(Boolean).join(' · '), counted: factor },
        ...prev,
      ];
    });
  };

  const setQty = (variant: string, counted: number) =>
    change((prev) => prev.map((l) => (l.variant === variant ? { ...l, counted: Math.max(0, counted) } : l)));

  const post = () =>
    start(async () => {
      setAsking(false);
      const save = await saveStockCountLines(null, {
        count: id,
        lines: lines.map(({ variant, counted }) => ({ variant, counted })),
      });
      const result = save.ok ? await postStockCount(null, { count: id }) : save;
      if (result.ok) {
        toast.success(t.posted);
        router.replace('/staff/count');
        router.refresh();
      } else toast.error(result.message === 'emptyCount' ? t.emptyCount : t.postError);
    });

  return (
    <div className="space-y-4">
      <ScanField onScan={onScan} t={t.scan} />
      <div className="gg-card flex items-center gap-4 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tabular-nums">{interpolate(t.items, { n: lines.length })}</span>
          <span className="text-ink/55 text-xs tabular-nums">
            {interpolate(t.units, { n: lines.reduce((sum, l) => sum + l.counted, 0) })}
          </span>
        </span>
        <span
          aria-live="polite"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            state === 'error'
              ? 'bg-red-50 text-red-700'
              : state === 'saving'
                ? 'text-ink/60 bg-[#e7ecf3]'
                : 'bg-emerald-50 text-emerald-700',
          )}
        >
          {state === 'error' ? (
            <CloudOff className="h-3.5 w-3.5" />
          ) : state === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {state === 'saving' ? t.saving : state === 'error' ? t.saveError : t.saved}
        </span>
      </div>
      {lines.length === 0 ? (
        <Empty icon={<ScanBarcode />} text={t.hint} />
      ) : (
        <ul className="divide-border gg-card divide-y">
          {lines.map((line) => (
            <li key={line.variant} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3">
              <span className="min-w-0 flex-1 text-sm font-medium">{line.name}</span>
              <button
                type="button"
                aria-label="−"
                onClick={() => setQty(line.variant, line.counted - 1)}
                className="border-border hover:border-ink grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white transition"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                aria-label={`${t.qty} ${line.name}`}
                inputMode="numeric"
                value={line.counted}
                onChange={(e) => setQty(line.variant, Number(e.target.value.replace(/\D/g, '')) || 0)}
                className="border-border focus:border-gold-deep h-11 w-16 shrink-0 rounded-lg border bg-white text-center text-base font-semibold tabular-nums outline-none"
              />
              <button
                type="button"
                aria-label="+"
                onClick={() => setQty(line.variant, line.counted + 1)}
                className="border-border hover:border-ink grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2 md:bottom-4">
        <Button
          type="button"
          onClick={() => setAsking(true)}
          disabled={pending || lines.length === 0}
          className="w-full shadow-lg"
        >
          {pending ? t.posting : t.post}
        </Button>
      </div>
      <Sheet open={asking} onOpenChange={setAsking} label={t.confirmTitle} closeLabel={t.cancel} variant="bottom">
        <div className="space-y-4 p-5 pt-6">
          <h2 className="pr-10 text-xl">{t.confirmTitle}</h2>
          <p className="text-ink/70 text-sm">{t.confirm}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setAsking(false)}>
              {t.cancel}
            </Button>
            <Button type="button" className="flex-1" onClick={post}>
              {t.post}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
