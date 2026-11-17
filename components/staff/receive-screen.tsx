'use client';

import { Check, CheckCheck, Info, Minus, Package, PackageCheck, Plus, Wine } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { interpolate } from '@/lib/i18n';
import { lookupBarcode } from '@/modules/catalogue/actions';
import { receivePurchase } from '@/modules/purchasing/actions';
import type { OrderToReceive } from '@/modules/purchasing/service';
import { ScanField, type ScanTexts } from './scan-field';
import { missed, scanned } from './feedback';
import { SuccessTick } from './success-tick';

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
  hint: string;
  all: string;
  already: string;
  complete: string;
  toReceive: string;
  bottle: string;
  progress: string;
};

type Row = {
  key: string;
  variant: string;
  unit: string | null;
  name: string;
  unitLabel: string | null;
  ordered: number;
  received: number;
  now: number;
  reason: string;
  extra: boolean;
};

const keyOf = (variant: string, unit: string | null) => `${variant}:${unit ?? ''}`;

/**
 * Receiving a purchase order on the phone (M3.1 T4). Each scan adds one to the line of that size and unit (a box's
 * barcode counts a box, a bottle's a bottle); steppers correct by hand. More than remains asks for a reason. A size
 * not on the order is added only for managers. Confirm sends everything in one receipt.
 */
export function ReceiveScreen({ order, manager, t }: { order: OrderToReceive; manager: boolean; t: Texts }) {
  const [rows, setRows] = useState<Row[]>(
    order.lines.map((l) => ({
      key: keyOf(l.variant, l.unit),
      variant: l.variant,
      unit: l.unit,
      name: l.name,
      unitLabel: l.unitLabel,
      ordered: l.ordered,
      received: l.received,
      now: 0,
      reason: '',
      extra: false,
    })),
  );
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ status: string; number: string } | null>(null);

  const bump = (key: string, by: number) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, now: Math.max(0, r.now + by) } : r)));
  const over = (r: Row) => !r.extra && r.received + r.now > r.ordered;

  const onScan = async (code: string) => {
    const hit = await lookupBarcode(null, { code });
    if (!hit.ok) return void (missed(), toast.error(interpolate(t.notFound, { code })));
    const key = keyOf(hit.data.card.variant, hit.data.unit);
    const name = [hit.data.card.name, hit.data.card.label].filter(Boolean).join(' · ');
    const unitLabel = hit.data.unit ? (hit.data.card.units.find((u) => u.id === hit.data.unit)?.label ?? null) : null;
    if (!rows.some((r) => r.key === key)) {
      if (!manager) return void (missed(), toast.error(interpolate(t.notOnOrder, { name })));
      setRows((prev) => [
        ...prev,
        {
          key,
          variant: hit.data.card.variant,
          unit: hit.data.unit,
          name,
          unitLabel,
          ordered: 0,
          received: 0,
          now: 1,
          reason: '',
          extra: true,
        },
      ]);
    } else bump(key, 1);
    scanned();
    toast(interpolate(t.added, { name: unitLabel ? `${name} (${unitLabel})` : name }));
  };

  const confirm = () =>
    start(async () => {
      const lines = rows.filter((r) => r.now > 0);
      if (lines.length === 0) return void toast.error(t.nothing);
      if (lines.some((r) => over(r) && r.reason.trim().length < 3)) return void toast.error(t.reasonNeeded);
      const result = await receivePurchase(null, {
        order: order.id,
        lines: lines.map((r) => ({
          variant: r.variant,
          unit: r.unit,
          unitQty: r.now,
          reason: over(r) ? r.reason.trim() : undefined,
        })),
      });
      if (result.ok) setDone(result.data);
      else toast.error(result.message === 'overReceipt' ? t.reasonNeeded : t.error);
    });

  if (done) {
    return (
      <div className="gg-card space-y-4 p-6 text-center">
        <SuccessTick />
        <h2 className="text-xl">{t.doneTitle}</h2>
        <p className="text-ink/70 text-sm">{done.status === 'received' ? t.doneReceived : t.donePartly}</p>
        <ul className="text-left text-sm">
          {rows
            .filter((r) => r.now > 0)
            .map((r) => (
              <li key={r.key} className="border-border flex justify-between border-t py-2">
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

  const left = (r: Row) => Math.max(0, r.ordered - r.received);
  const complete = (r: Row) => !r.extra && r.received + r.now >= r.ordered;
  const doneLines = rows.filter(complete).length;
  const units = rows.reduce((sum, r) => sum + r.now, 0);
  const regular = rows.filter((r) => !r.extra).length;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 ring-inset">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t.hint}
      </p>
      <ScanField onScan={onScan} t={t.scan} busy={pending} />
      <div className="gg-card space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">{interpolate(t.progress, { done: doneLines, total: regular })}</span>
          <span className="text-ink/60 tabular-nums">{interpolate(t.toReceive, { n: units })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#e7ecf3]">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${regular ? Math.round((doneLines / regular) * 100) : 0}%` }}
          />
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const ok = complete(r);
          const Icon = r.unit ? Package : Wine;
          return (
            <li
              key={r.key}
              data-line={r.key}
              className={cn('gg-card space-y-3 p-3 transition sm:p-4', ok && 'border-emerald-300 bg-emerald-50/40')}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-[10px]',
                    ok ? 'bg-emerald-100 text-emerald-700' : 'bg-champagne text-gold-deep',
                  )}
                >
                  {ok ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="text-ink/70 rounded-full bg-[#e7ecf3] px-2 py-0.5 font-medium">
                      {r.unitLabel ?? t.bottle}
                    </span>
                    <span className="text-ink/55">
                      {r.extra
                        ? t.extra
                        : [
                            interpolate(t.ordered, { n: r.ordered }),
                            interpolate(t.already, { n: r.received }),
                            interpolate(t.remaining, { n: left(r) }),
                          ].join(' · ')}
                    </span>
                  </p>
                </div>
                {ok && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    {t.complete}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => bump(r.key, -1)}
                  className="border-border hover:border-ink grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white transition"
                >
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
                  className="border-border focus:border-gold-deep h-11 w-16 shrink-0 rounded-lg border bg-white text-center text-base font-semibold tabular-nums outline-none"
                />
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => bump(r.key, 1)}
                  className="border-border hover:border-ink grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {!r.extra && left(r) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border ml-auto"
                    onClick={() => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, now: left(x) } : x)))}
                  >
                    <CheckCheck className="h-4 w-4" />
                    {t.all} ({left(r)})
                  </Button>
                )}
              </div>
              {over(r) && (
                <input
                  aria-label={`${t.reason} ${r.name}`}
                  placeholder={t.reason}
                  value={r.reason}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, reason: e.target.value } : x)))
                  }
                  className="h-11 w-full rounded-lg border border-amber-300 bg-amber-50/70 px-3 text-sm"
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2 md:bottom-4">
        <Button type="button" onClick={confirm} disabled={pending || units === 0} className="h-12 w-full shadow-lg">
          <PackageCheck className="h-4 w-4" />
          {pending ? t.confirming : units > 0 ? `${t.confirm} · ${interpolate(t.toReceive, { n: units })}` : t.confirm}
        </Button>
      </div>
    </div>
  );
}
