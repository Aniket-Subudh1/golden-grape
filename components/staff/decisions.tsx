'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Decision, DecisionText } from '@/components/admin/decision-bar';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import type { ActionResult } from '@/lib/action';
import { cn } from '@/lib/cn';

type Action = (prev: unknown, input: FormData) => Promise<ActionResult<unknown>>;

const input = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-base';

/**
 * The admin's decisions (modules/sales/admin/decisions.ts) on the phone (M3.1 T5): the same moves, words, fields and
 * actions as DecisionBar, as touch buttons; each one confirms in a bottom sheet, an `instant` one runs on the tap.
 */
export function StaffDecisions({ action, target, decisions, text }: { action: Action; target: Record<string, string>; decisions: Decision[]; text: DecisionText }) {
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
        toast.error(text.errors[result.message ?? ''] ?? (field && text.errors[field]) ?? text.errors[result.error] ?? text.error);
        if (result.error === 'CONFLICT') router.refresh();
        return;
      }
      toast.success(text.done);
      setOpen(null);
      router.refresh();
    });

  if (decisions.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => (
          <Button
            key={d.to}
            type="button"
            size="sm"
            variant={d.tone === 'primary' ? 'solid' : 'outline'}
            disabled={pending}
            className={cn(d.tone === 'danger' && 'border-red-700/40 text-red-800 hover:bg-red-800 hover:text-bone')}
            onClick={() => (d.instant ? submit(d) : setOpen(d))}
          >
            {d.label}
          </Button>
        ))}
      </div>
      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)} label={open?.label ?? ''} closeLabel={text.back} variant="bottom">
        {open && (
          <form
            className="space-y-4 p-5 pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit(open, e.currentTarget);
            }}
          >
            <h2 className="pr-10 font-serif text-2xl">{open.label}</h2>
            <p className="text-sm text-ink/70">{open.hint}</p>
            {(open.fields ?? []).map((f) => (
              <label key={f.name} className="block text-sm">
                <span className="eyebrow mb-1 block text-ink/60">{f.label}</span>
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
                <span className="eyebrow mb-1 block text-ink/60">{open.reason === 'required' ? (text.reasonMandatory ?? text.reason) : text.reason}</span>
                <input name="reason" defaultValue={open.reasonValue} required={open.reason === 'required'} minLength={open.reason === 'required' ? 3 : undefined} placeholder={text.reasonPh} maxLength={300} className={input} />
              </label>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(null)} disabled={pending}>
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
