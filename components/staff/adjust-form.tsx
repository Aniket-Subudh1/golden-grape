'use client';

import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { interpolate } from '@/lib/i18n';
import { adjustStock } from '@/modules/inventory/actions';
import { done } from './feedback';

type Texts = {
  title: string;
  reason: string;
  note: string;
  submit: string;
  pending: string;
  done: string;
  add: string;
  remove: string;
  after: string;
  tooMany: string;
  howMany: string;
};

// Which reasons fit which way: goods in, or bottles out. "Entry mistake", "stock count correction" and "other" go both
// ways. The server accepts any of them either way (adjustStock); this only puts the likely ones first.
const IN = ['received', 'inventory', 'correction', 'other'];
const OUT = ['breakage', 'tasting', 'gift', 'theft', 'inventory', 'correction', 'other'];

/**
 * A stock correction (M2.1's "Corriger le stock", same action): add or remove, how many (stepper, or one tap for a
 * bottle or a box), why (chips), and the stock it leaves before saving. Never below zero.
 */
export function AdjustForm({
  variant,
  onHand,
  boxes,
  reasons,
  t,
  messages,
}: {
  variant: string;
  onHand: number;
  /** The product's box sizes (6, 12): one tap sets that many bottles. */
  boxes: number[];
  reasons: { value: string; label: string }[];
  t: Texts;
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
}) {
  const router = useRouter();
  const [way, setWay] = useState<'in' | 'out'>('in');
  const [n, setN] = useState(1);
  const shown = reasons.filter((r) => (way === 'in' ? IN : OUT).includes(r.value));
  const [reason, setReason] = useState(shown[0]?.value ?? 'other');
  const after = onHand + (way === 'in' ? n : -n);
  const blocked = n <= 0 || after < 0;

  const switchWay = (next: 'in' | 'out') => {
    setWay(next);
    setReason((next === 'in' ? IN : OUT)[0]);
  };

  return (
    <ActionForm
      action={adjustStock}
      messages={{ ...messages, success: t.done }}
      onSuccess={() => {
        done();
        setN(1);
        router.refresh();
      }}
      className="gg-card space-y-5 p-4 md:p-5"
    >
      <h2 className="text-lg">{t.title}</h2>
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="qty" value={way === 'in' ? n : -n} />
      <input type="hidden" name="reason" value={reason} />

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.title}>
        {(['in', 'out'] as const).map((w) => {
          const on = way === w;
          const Icon = w === 'in' ? Plus : Minus;
          return (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => switchWay(w)}
              className={cn(
                'flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
                on && w === 'in' && 'border-emerald-600 bg-emerald-600 text-white',
                on && w === 'out' && 'border-red-600 bg-red-600 text-white',
                !on && 'border-border text-ink/70 hover:border-ink bg-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {w === 'in' ? t.add : t.remove}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-ink/80 text-sm font-medium">{t.howMany}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="−"
            onClick={() => setN((x) => Math.max(1, x - 1))}
            className="border-border hover:border-ink grid h-12 w-12 shrink-0 place-items-center rounded-full border bg-white transition"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            aria-label={t.howMany}
            inputMode="numeric"
            value={n}
            onChange={(e) => setN(Number(e.target.value.replace(/\D/g, '')) || 0)}
            className="border-border focus:border-gold-deep h-12 w-20 shrink-0 rounded-xl border bg-white text-center text-xl font-semibold tabular-nums outline-none"
          />
          <button
            type="button"
            aria-label="+"
            onClick={() => setN((x) => x + 1)}
            className="border-border hover:border-ink grid h-12 w-12 shrink-0 place-items-center rounded-full border bg-white transition"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="flex w-full gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
            {[1, ...boxes].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setN(q)}
                className={cn(
                  'h-9 min-w-10 flex-1 rounded-lg border px-2.5 text-sm font-medium tabular-nums transition sm:flex-none',
                  n === q ? 'border-ink bg-ink text-white' : 'border-border hover:border-ink bg-white',
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-ink/80 mb-2 text-sm font-medium">{t.reason}</legend>
        <div className="flex flex-wrap gap-2">
          {shown.map((r) => {
            const on = reason === r.value;
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={on}
                onClick={() => setReason(r.value)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition',
                  on
                    ? 'border-gold-deep bg-champagne text-ink font-medium'
                    : 'border-border text-ink/75 hover:border-ink bg-white',
                )}
              >
                {on && <Check className="text-gold-deep h-3.5 w-3.5" />}
                {r.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      {reason === 'other' && <Field look="box" label={t.note} name="note" required />}

      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm',
          after < 0 ? 'bg-red-50 text-red-800' : 'text-ink/80 bg-[#f3f5f9]',
        )}
        aria-live="polite"
      >
        {after < 0 ? (
          <span>{interpolate(t.tooMany, { n: onHand })}</span>
        ) : (
          <>
            <span>{t.after}</span>
            <span className="flex items-center gap-2 font-semibold tabular-nums">
              <span className="text-ink/50">{onHand}</span>
              <ArrowRight className="text-ink/40 h-4 w-4" />
              <span className={way === 'in' ? 'text-emerald-700' : 'text-red-700'}>{after}</span>
            </span>
          </>
        )}
      </div>

      <SubmitButton label={t.submit} pendingLabel={t.pending} className="h-12 w-full" disabled={blocked} />
    </ActionForm>
  );
}
