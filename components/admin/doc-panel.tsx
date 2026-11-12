import type { ReactNode } from 'react';

// The read-only summary at the top of documents that only services write (orders, reservations, event bookings):
// a status header with the next steps, info cards, and the history. Server-safe: no hooks.

export function DocPanel({ children }: { children: ReactNode }) {
  return <div className="gg-doc">{children}</div>;
}

/**
 * Status badges (the document's, and its payment's when it has one), a one-line summary, the key figures, what staff
 * should do next and, below, the decisions open to them.
 */
export function DocHead({ badge, title, sub, figures, next, children }: { badge: ReactNode; title: ReactNode; sub?: ReactNode; figures?: ReactNode; next?: ReactNode; children?: ReactNode }) {
  return (
    <section className="gg-doc__head">
      <div className="gg-doc__title">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <div className="gg-doc__badges">{badge}</div>
      </div>
      {figures}
      {next && <div className="gg-doc__next">{next}</div>}
      {children}
    </section>
  );
}

/** A labelled status pill in the header: "Commande · Confirmée", "Paiement · Payé". */
export function DocBadge({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <span className="gg-doc__badge">
      <small>{label}</small>
      <span className={`gg-badge gg-badge--${tone}`}>{children}</span>
    </span>
  );
}

/** The money at a glance: total, received, remaining (orders and event bookings). `strong` marks the one to act on. */
export function DocFigures({ items }: { items: { label: string; value: ReactNode; tone?: 'due' | 'ok' | 'alert' }[] }) {
  return (
    <dl className="gg-doc__figures">
      {items.map((f) => (
        <div key={f.label} data-tone={f.tone}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
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
