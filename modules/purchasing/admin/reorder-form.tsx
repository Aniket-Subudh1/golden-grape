'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createDraftPurchase } from '../actions';

type Row = { variant: string; name: string; sku: string; onHand: number; threshold: number; unit: { id: string; label: string } | null; costCents: number | null; suggested: number };
type Texts = { item: string; onHand: string; level: string; buy: string; cost: string; create: string; creating: string; error: string; noneSelected: string };

/**
 * One supplier's low-stock sizes with the suggested quantity (editable) and a tick per row; "Create draft" makes a
 * draft purchase order for the ticked rows and opens it (M3.1 T4). Only managers get the button.
 */
export function ReorderForm({ supplier, rows, t, canCreate, money }: { supplier: string; rows: Row[]; t: Texts; canCreate: boolean; money: Record<string, string> }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(rows.map((r) => [r.variant, r.suggested])));
  const [picked, setPicked] = useState<Record<string, boolean>>(Object.fromEntries(rows.map((r) => [r.variant, true])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const lines = rows.filter((r) => picked[r.variant] && qty[r.variant] > 0).map((r) => ({ variant: r.variant, unit: r.unit?.id ?? null, unitQty: qty[r.variant] }));
      if (lines.length === 0) return setError(t.noneSelected);
      const result = await createDraftPurchase(null, { supplier, lines });
      if (result.ok) router.push(`/admin/collections/purchaseOrders/${result.data.id}`);
      else setError(t.error);
    });

  return (
    <div className="gg-reorder">
      <div className="table">
        <table>
          <thead>
            <tr>
              {canCreate && <th aria-label="✓" />}
              <th>{t.item}</th>
              <th>{t.onHand}</th>
              <th>{t.level}</th>
              <th>{t.cost}</th>
              <th>{t.buy}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variant}>
                {canCreate && (
                  <td>
                    <input type="checkbox" checked={picked[r.variant]} onChange={(e) => setPicked({ ...picked, [r.variant]: e.target.checked })} aria-label={r.name} />
                  </td>
                )}
                <td>
                  {r.name}
                  <br />
                  <small>{r.sku}</small>
                </td>
                <td>{r.onHand}</td>
                <td>{r.threshold}</td>
                <td>{r.costCents === null ? '—' : money[r.variant]}</td>
                <td>
                  {canCreate ? (
                    <input className="gg-reorder__qty" inputMode="numeric" value={qty[r.variant]} aria-label={`${t.buy} ${r.name}`} onChange={(e) => setQty({ ...qty, [r.variant]: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                  ) : (
                    qty[r.variant]
                  )}{' '}
                  {r.unit?.label ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canCreate && (
        <p className="gg-reorder__actions">
          <button type="button" className="btn btn--style-primary btn--size-medium" disabled={pending} onClick={create}>
            {pending ? t.creating : t.create}
          </button>
          {error && <span className="gg-reorder__error">{error}</span>}
        </p>
      )}
    </div>
  );
}
