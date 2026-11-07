'use client';

import { toast } from '@payloadcms/ui';
import { useRef, useState } from 'react';
import type { ActionResult } from '@/lib/action';

// The buttons for the moves a document may make next (only those the state machine allows are passed in). Each one
// first says what will happen — stock, e-mail — and asks for a reason when it undoes something, plus any details the
// move needs (an amount, the bank's date…); then it runs the staff action and reloads the page so the summary shows
// the new state.

type Action = (prev: unknown, input: FormData) => Promise<ActionResult<unknown>>;

/** A detail typed before confirming. `money` is typed in € ("12,50"), `date` is a day. */
export type DecisionField = {
  name: string;
  label: string;
  kind: 'money' | 'date' | 'text' | 'select';
  value?: string;
  required?: boolean;
  max?: string;
  options?: { value: string; label: string }[];
};

export type Decision = {
  to: string;
  label: string;
  hint: string;
  tone?: 'primary' | 'danger';
  /** Ask for a reason: optional (`true`) or mandatory. */
  reason?: boolean | 'required';
  /** Prefilled reason, e.g. the one given when the refund was asked for. */
  reasonValue?: string;
  fields?: DecisionField[];
  /** Runs instead of the bar's action (money forms beside the status moves). */
  action?: Action;
};

export type DecisionText = { confirm: string; back: string; reason: string; reasonPh: string; done: string; errors: Record<string, string>; error: string };

type Props = {
  action: Action;
  /** The document the action works on, e.g. `{ order: id }`. */
  target: Record<string, string>;
  decisions: Decision[];
  text: DecisionText;
};

export default function DecisionBar({ action, target, decisions, text }: Props) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  if (decisions.length === 0) return null;

  // Not a <form>: the panel sits inside Payload's edit form, and a form inside a form never submits.
  async function submit() {
    if (!open || !box.current) return;
    const fields = [...box.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name], select[name]')];
    if (!fields.every((f) => f.reportValidity())) return;
    setBusy(true);
    const input = new FormData();
    for (const f of fields) if (f.value.trim() !== '') input.set(f.name, f.value.trim());
    for (const [key, value] of Object.entries({ ...target, to: open.to })) input.set(key, value);
    const result = await (open.action ?? action)(null, input);
    if (!result.ok) {
      setBusy(false);
      const field = Object.values(result.fieldErrors ?? {})[0]?.[0];
      toast.error(text.errors[result.message ?? ''] ?? (field && text.errors[field]) ?? text.errors[result.error] ?? text.error);
      if (result.error === 'CONFLICT') window.setTimeout(() => window.location.reload(), 1200);
      return;
    }
    toast.success(text.done);
    window.location.reload();
  }

  if (open) {
    return (
      <div
        ref={box}
        className={`gg-decide gg-decide--confirm${open.tone === 'danger' ? ' gg-decide--danger' : ''}`}
        onKeyDown={(e) => {
          // Enter confirms here instead of submitting Payload's form around the panel.
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <p>
          <b>{open.label}</b> — {open.hint}
        </p>
        {(open.fields ?? []).length > 0 && (
          <div className="gg-decide__fields">
            {open.fields!.map((f) => (
              <label key={f.name} className="gg-decide__reason">
                <span>{f.label}</span>
                {f.kind === 'select' ? (
                  <select name={f.name} defaultValue={f.value} required={f.required}>
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
                    type={f.kind === 'date' ? 'date' : 'text'}
                    max={f.kind === 'date' ? f.max : undefined}
                    inputMode={f.kind === 'money' ? 'decimal' : undefined}
                    pattern={f.kind === 'money' ? '\\s*\\d+([.,]\\d{1,2})?\\s*€?\\s*' : undefined}
                    maxLength={f.kind === 'text' ? 80 : undefined}
                  />
                )}
              </label>
            ))}
          </div>
        )}
        {open.reason && (
          <label className="gg-decide__reason">
            <span>{text.reason}</span>
            <input name="reason" defaultValue={open.reasonValue} required={open.reason === 'required'} minLength={open.reason === 'required' ? 3 : undefined} placeholder={text.reasonPh} maxLength={300} />
          </label>
        )}
        <div className="gg-decide__buttons">
          <button type="button" className={`gg-btn ${open.tone === 'danger' ? 'gg-btn--danger' : 'gg-btn--primary'}`} disabled={busy} onClick={submit}>
            {text.confirm}
          </button>
          <button type="button" className="gg-btn" disabled={busy} onClick={() => setOpen(null)}>
            {text.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-decide">
      {decisions.map((d) => (
        <button
          key={d.to}
          type="button"
          className={`gg-btn${d.tone === 'primary' ? ' gg-btn--primary' : d.tone === 'danger' ? ' gg-btn--quiet-danger' : ''}`}
          onClick={() => setOpen(d)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
