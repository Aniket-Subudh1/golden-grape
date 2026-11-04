'use client';

import { toast } from '@payloadcms/ui';
import { useState } from 'react';
import type { ActionResult } from '@/lib/action';

// The buttons for the moves a document may make next (only those the state machine allows are passed in). Each one
// first says what will happen — stock, e-mail — and asks for a reason when it undoes something; then it runs the
// staff action and reloads the page so the summary shows the new state.

export type Decision = { to: string; label: string; hint: string; tone?: 'primary' | 'danger'; reason?: boolean };

export type DecisionText = { confirm: string; back: string; reason: string; reasonPh: string; done: string; errors: Record<string, string>; error: string };

type Props = {
  action: (prev: unknown, input: FormData) => Promise<ActionResult<unknown>>;
  /** The document the action works on, e.g. `{ order: id }`. */
  target: Record<string, string>;
  decisions: Decision[];
  text: DecisionText;
};

export default function DecisionBar({ action, target, decisions, text }: Props) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (decisions.length === 0) return null;

  async function run(decision: Decision) {
    setBusy(true);
    const input = new FormData();
    for (const [key, value] of Object.entries({ ...target, to: decision.to, reason: reason.trim() })) if (value) input.set(key, value);
    const result = await action(null, input);
    if (!result.ok) {
      setBusy(false);
      toast.error(text.errors[result.message ?? ''] ?? text.errors[result.error] ?? text.error);
      if (result.error === 'CONFLICT') window.setTimeout(() => window.location.reload(), 1200);
      return;
    }
    toast.success(text.done);
    window.location.reload();
  }

  if (open) {
    return (
      <div className={`gg-decide gg-decide--confirm${open.tone === 'danger' ? ' gg-decide--danger' : ''}`}>
        <p>
          <b>{open.label}</b> — {open.hint}
        </p>
        {open.reason && (
          <label className="gg-decide__reason">
            <span>{text.reason}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={text.reasonPh} maxLength={300} />
          </label>
        )}
        <div className="gg-decide__buttons">
          <button type="button" className={`gg-btn ${open.tone === 'danger' ? 'gg-btn--danger' : 'gg-btn--primary'}`} disabled={busy} onClick={() => run(open)}>
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
          onClick={() => {
            setReason('');
            setOpen(d);
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
