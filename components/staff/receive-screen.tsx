'use client';

import { Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { interpolate } from '@/lib/i18n';
import { lookupBarcode } from '@/modules/catalogue/actions';
import { receivePurchase } from '@/modules/purchasing/actions';
import type { OrderToReceive } from '@/modules/purchasing/service';
import { ScanField, type ScanTexts } from './scan-field';

type Texts = {
  scan: ScanTexts;
  ordered: string;
  remaining: string;
  now: string;
  extra: string;
  reason: string;
  reasonNeeded: string;
  notFound: string;
  notOnOrder: string;
  added: string;
  confirm: string;
  confirming: string;
  nothing: string;
  error: string;
  doneTitle: string;
  doneReceived: string;
  donePartly: string;
  back: string;
  qty: string;
};

type Row = { key: string; variant: string; unit: string | null; name: string; unitLabel: string | null; ordered: number; received: number; now: number; reason: string; extra: boolean };

const keyOf = (variant: string, unit: string | null) => `${variant}:${unit ?? ''}`;

/**
 * Receiving a purchase order on the phone (M3.1 T4). Each scan adds one to the line of that size and unit (a box's
 * barcode counts a box, a bottle's a bottle); steppers correct by hand. More than remains asks for a reason. A size
 * not on the order is added only for managers. Confirm sends everything in one receipt.
 */
export function ReceiveScreen({ order, manager, t }: { order: OrderToReceive; manager: boolean; t: Texts }) {
  const [rows, setRows] = useState<Row[]>(order.lines.map((l) => ({ key: keyOf(l.variant, l.unit), variant: l.variant, unit: l.unit, name: l.name, unitLabel: l.unitLabel, ordered: l.ordered, received: l.received, now: 0, reason: '', extra: false })));
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ status: string; number: string } | null>(null);

  const bump = (key: string, by: number) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, now: Math.max(0, r.now + by) } : r)));
  const over = (r: Row) => !r.extra && r.received + r.now > r.ordered;

  const onScan = async (code: string) => {
    const hit = await lookupBarcode(null, { code });
    if (!hit.ok) return void toast.error(interpolate(t.notFound, { code }));
    const key = keyOf(hit.data.card.variant, hit.data.unit);
    const name = [hit.data.card.name, hit.data.card.label].filter(Boolean).join(' · ');
    const unitLabel = hit.data.unit ? (hit.data.card.units.find((u) => u.id === hit.data.unit)?.label ?? null) : null;
    if (!rows.some((r) => r.key === key)) {
      if (!manager) return void toast.error(interpolate(t.notOnOrder, { name }));
      setRows((prev) => [...prev, { key, variant: hit.data.card.variant, unit: hit.data.unit, name, unitLabel, ordered: 0, received: 0, now: 1, reason: '', extra: true }]);
    } else bump(key, 1);
    navigator.vibrate?.(40);
    toast.success(interpolate(t.added, { name: unitLabel ? `${name} (${unitLabel})` : name }));
  };

  const confirm = () =>
    start(async () => {
      const lines = rows.filter((r) => r.now > 0);
      if (lines.length === 0) return void toast.error(t.nothing);
      if (lines.some((r) => over(r) && r.reason.trim().length < 3)) return void toast.error(t.reasonNeeded);
      const result = await receivePurchase(null, { order: order.id, lines: lines.map((r) => ({ variant: r.variant, unit: r.unit, unitQty: r.now, reason: over(r) ? r.reason.trim() : undefined })) });
      if (result.ok) setDone(result.data);
      else toast.error(result.message === 'overReceipt' ? t.reasonNeeded : t.error);
    });

  if (done) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-white/70 p-5 text-center">
        <h2 className="font-serif text-2xl">{t.doneTitle}</h2>
        <p className="text-sm text-ink/70">{done.status === 'received' ? t.doneReceived : t.donePartly}</p>
        <ul className="text-left text-sm">
          {rows
            .filter((r) => r.now > 0)
            .map((r) => (
              <li key={r.key} className="flex justify-between border-t border-border py-2">
                <span>{r.unitLabel ? `${r.name} (${r.unitLabel})` : r.name}</span>
                <span className="tabular-nums">+{r.now}</span>
              </li>
            ))}
        </ul>
        <Button asChild className="w-full">
          <Link href="/staff/receive">{t.back}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScanField onScan={onScan} t={t.scan} busy={pending} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-white/70">
        {rows.map((r) => (
          <li key={r.key} className="space-y-2 px-3 py-3" data-line={r.key}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p>{r.unitLabel ? `${r.name} (${r.unitLabel})` : r.name}</p>
                <p className="text-xs text-ink/55">
                  {r.extra ? t.extra : `${interpolate(t.ordered, { n: r.ordered })} · ${interpolate(t.remaining, { n: Math.max(0, r.ordered - r.received) })}`}
                </p>
              </div>
              <button type="button" aria-label="−" onClick={() => bump(r.key, -1)} className="grid h-11 w-11 place-items-center rounded-full border border-border">
                <Minus className="h-4 w-4" />
              </button>
              <input
                aria-label={`${t.qty} ${r.name}`}
                inputMode="numeric"
                value={r.now}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, '')) || 0;
                  setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, now: n } : x)));
                }}
                className="h-11 w-14 rounded-lg border border-border bg-white text-center tabular-nums"
              />
              <button type="button" aria-label="+" onClick={() => bump(r.key, 1)} className="grid h-11 w-11 place-items-center rounded-full border border-border">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {over(r) && (
              <input
                aria-label={`${t.reason} ${r.name}`}
                placeholder={t.reason}
                value={r.reason}
                onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, reason: e.target.value } : x)))}
                className="h-11 w-full rounded-lg border border-amber-300 bg-amber-50/70 px-3 text-sm"
              />
            )}
          </li>
        ))}
      </ul>
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2">
        <Button type="button" onClick={confirm} disabled={pending} className="w-full shadow-lg">
          {pending ? t.confirming : t.confirm}
        </Button>
      </div>
    </div>
  );
}
