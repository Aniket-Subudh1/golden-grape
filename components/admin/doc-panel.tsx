import type { ReactNode } from 'react';

// The read-only summary at the top of documents that only services write (orders, reservations, event bookings):
// a status header with the next steps, info cards, and the history. Server-safe: no hooks.

export function DocPanel({ children }: { children: ReactNode }) {
  return <div className="gg-doc">{children}</div>;
}

/** Status badge, a one-line summary and, below, the decisions open to staff. */
export function DocHead({ badge, title, sub, children }: { badge: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="gg-doc__head">
      <div className="gg-doc__title">
        {badge}
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DocGrid({ children }: { children: ReactNode }) {
  return <div className="gg-doc__grid">{children}</div>;
}

export function DocCard({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`gg-doc__card${wide ? ' gg-doc__card--wide' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Label / value rows inside a card. */
export function DocFacts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="gg-doc__facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type HistoryRow = { when: string; text: ReactNode; by?: string | null; note?: string | null };

export function DocHistory({ rows, empty }: { rows: HistoryRow[]; empty: string }) {
  if (rows.length === 0) return <p className="gg-doc__muted">{empty}</p>;
  return (
    <ol className="gg-doc__history">
      {rows.map((r, i) => (
        <li key={i}>
          <time>{r.when}</time>
          <div>
            <b>{r.text}</b>
            {(r.by || r.note) && (
              <p>
                {r.by}
                {r.by && r.note && ' · '}
                {r.note && <q>{r.note}</q>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
