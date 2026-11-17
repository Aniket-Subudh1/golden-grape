'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { interpolate } from '@/lib/i18n';
import { lookupBarcode } from '@/modules/catalogue/actions';
import { postStockCount, saveStockCountLines } from '@/modules/inventory/actions';
import { ScanField, type ScanTexts } from './scan-field';

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
      <p className="text-ink/55 text-right text-xs" aria-live="polite">
        {state === 'saving' ? t.saving : state === 'error' ? t.saveError : t.saved}
      </p>
      {lines.length === 0 ? (
        <p className="border-border text-ink/55 rounded-xl border border-dashed p-6 text-center text-sm">{t.empty}</p>
      ) : (
        <ul className="divide-border gg-card divide-y">
          {lines.map((line) => (
            <li key={line.variant} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">{line.name}</span>
              <button
                type="button"
                aria-label="−"
                onClick={() => setQty(line.variant, line.counted - 1)}
                className="border-border grid h-11 w-11 place-items-center rounded-full border"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                aria-label={`${t.qty} ${line.name}`}
                inputMode="numeric"
                value={line.counted}
                onChange={(e) => setQty(line.variant, Number(e.target.value.replace(/\D/g, '')) || 0)}
                className="border-border h-11 w-16 rounded-lg border bg-white text-center tabular-nums"
              />
              <button
                type="button"
                aria-label="+"
                onClick={() => setQty(line.variant, line.counted + 1)}
                className="border-border grid h-11 w-11 place-items-center rounded-full border"
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2">
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
          <h2 className="font-serif text-2xl">{t.confirmTitle}</h2>
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
