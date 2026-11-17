'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { findCustomers } from '@/modules/customers/actions';
import type { PickedCustomer } from './customer-form';

/** Search by name, company, e-mail or phone (M3.1 T5); each result is handed to `render` (a button or a link). */
export function CustomerSearch({
  t,
  render,
}: {
  t: { search: string; placeholder: string; none: string };
  render: (c: PickedCustomer) => React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedCustomer[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const r = await findCustomers(null, { q });
      setResults(r.ok ? r.data : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const shown = q.trim().length < 2 ? null : results;
  return (
    <div className="space-y-2">
      <label htmlFor="customer-q" className="eyebrow text-ink/60 block">
        {t.search}
      </label>
      <div className="gg-card focus-within:border-gold-deep flex h-12 items-center gap-2 px-3">
        <Search className="text-ink/40 h-5 w-5" />
        <input
          id="customer-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>
      {shown &&
        (shown.length === 0 ? (
          <p className="text-ink/55 text-sm">{t.none}</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((c) => (
              <li key={c.id}>{render(c)}</li>
            ))}
          </ul>
        ))}
    </div>
  );
}
