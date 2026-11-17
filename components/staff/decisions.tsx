'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  Banknote,
  Check,
  CircleCheck,
  CircleX,
  Handshake,
  Landmark,
  PackageCheck,
  RotateCcw,
  Truck,
  Undo2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type { Decision, DecisionText } from '@/components/admin/decision-bar';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import type { ActionResult } from '@/lib/action';
import { cn } from '@/lib/cn';

type Action = (prev: unknown, input: FormData) => Promise<ActionResult<unknown>>;

/** One icon per move (the decision's `to`), so a button reads at a glance. */
const ICONS: Record<string, typeof Check> = {
  confirmed: CircleCheck,
  ready: PackageCheck,
  out_for_delivery: Truck,
  completed: Handshake,
  cancelled: CircleX,
  payment: Banknote,
  bank_account: Landmark,
  refund: RotateCcw,
  refund_request: RotateCcw,
  return: Undo2,
  accepted: Check,
  rejected: X,
  no_show: UserX,
};
const RESERVATION_ICONS: Record<string, typeof Check> = { completed: UserCheck };

const input = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-base';

/**
 * The admin's decisions (modules/sales/admin/decisions.ts) on the phone (M3.1 T5): the same moves, words, fields and
 * actions as DecisionBar, as touch buttons; each one confirms in a bottom sheet, an `instant` one runs on the tap.
 */
export function StaffDecisions({
  action,
  target,
  decisions,
  text,
  kind = 'order',
}: {
  action: Action;
  target: Record<string, string>;
  decisions: Decision[];
  text: DecisionText;
  /** A table's moves use their own icons where a word is shared with orders ("completed" = the guests came). */
  kind?: 'order' | 'reservation';
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Decision | null>(null);
  const [pending, start] = useTransition();

  const submit = (d: Decision, form?: HTMLFormElement) =>
    start(async () => {
      if (form && !form.reportValidity()) return;
      const data = new FormData();
      if (form) for (const [k, v] of new FormData(form)) if (String(v).trim() !== '') data.set(k, String(v).trim());
      for (const [k, v] of Object.entries({ ...target, ...d.target, to: d.to })) data.set(k, v);
      const result = await (d.action ?? action)(null, data);
      if (!result.ok) {
        const field = Object.values(result.fieldErrors ?? {})[0]?.[0];
        toast.error(
          text.errors[result.message ?? ''] ?? (field && text.errors[field]) ?? text.errors[result.error] ?? text.error,
        );
        if (result.error === 'CONFLICT') router.refresh();
        return;
      }
      toast.success(text.done);
      setOpen(null);
      router.refresh();
    });

  if (decisions.length === 0) return null;
  // The first main move is the card's big button; every other move sits below it, two per row, with its icon.
  const main = decisions.find((x) => x.tone === 'primary');
  const rest = decisions.filter((x) => x !== main);
  const button = (d: Decision, big = false) => {
    const Icon = (kind === 'reservation' && RESERVATION_ICONS[d.to]) || ICONS[d.to] || ArrowRight;
    return (
      <Button
        key={d.to}
        type="button"
        size={big ? 'md' : 'sm'}
        variant={big ? 'solid' : 'outline'}
        disabled={pending}
        className={cn(
          'w-full',
          !big && 'border-border hover:border-ink h-auto min-h-10 py-2 whitespace-normal',
          d.tone === 'danger' && 'border-red-200 text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white',
        )}
        onClick={() => (d.instant ? submit(d) : setOpen(d))}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {d.label}
      </Button>
    );
  };
  return (
    <>
      <div className="space-y-2">
        {main && button(main, true)}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">{rest.map((d) => button(d))}</div>
        )}
      </div>
      <Sheet
        open={open !== null}
        onOpenChange={(v) => !v && setOpen(null)}
        label={open?.label ?? ''}
        closeLabel={text.back}
        variant="bottom"
      >
        {open && (
          <form
            className="space-y-4 p-5 pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit(open, e.currentTarget);
            }}
          >
            <h2 className="pr-10 font-serif text-2xl">{open.label}</h2>
            <p className="text-ink/70 text-sm">{open.hint}</p>
            {(open.fields ?? []).map((f) => (
              <label key={f.name} className="block text-sm">
                <span className="eyebrow text-ink/60 mb-1 block">{f.label}</span>
                {f.kind === 'select' ? (
                  <select name={f.name} defaultValue={f.value} required={f.required} className={input}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    defaultValue={f.value}
                    required={f.required}
                    type={f.kind === 'date' ? 'date' : f.kind === 'qty' ? 'number' : 'text'}
                    min={f.kind === 'qty' ? 0 : undefined}
                    max={f.kind === 'date' || f.kind === 'qty' ? f.max : undefined}
                    inputMode={f.kind === 'money' ? 'decimal' : undefined}
                    pattern={f.kind === 'money' ? '\\s*\\d+([.,]\\d{1,2})?\\s*€?\\s*' : undefined}
                    className={input}
                  />
                )}
              </label>
            ))}
            {open.reason && (
              <label className="block text-sm">
                <span className="eyebrow text-ink/60 mb-1 block">
                  {open.reason === 'required' ? (text.reasonMandatory ?? text.reason) : text.reason}
                </span>
                <input
                  name="reason"
                  defaultValue={open.reasonValue}
                  required={open.reason === 'required'}
                  minLength={open.reason === 'required' ? 3 : undefined}
                  placeholder={text.reasonPh}
                  maxLength={300}
                  className={input}
                />
              </label>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(null)}
                disabled={pending}
              >
                {text.back}
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                {text.confirm}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
