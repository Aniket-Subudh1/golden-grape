'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CustomerForm, type CustomerTexts } from './customer-form';
import { CustomerSearch } from './customer-search';

/** Find a customer, or create one, then open their page (M3.1 T5). */
export function CustomersScreen({
  t,
  messages,
}: {
  t: { search: { search: string; placeholder: string; none: string }; form: CustomerTexts; newCustomer: string };
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <CustomerSearch
        t={t.search}
        render={(c) => (
          <Link href={`/staff/customers/${c.id}`} className="gg-card block px-4 py-3">
            <span className="block">{c.company || c.name}</span>
            <span className="text-ink/55 text-xs">
              {[c.company ? c.name : null, c.phone].filter(Boolean).join(' · ')}
            </span>
          </Link>
        )}
      />
      {creating ? (
        <div className="gg-card p-4">
          <h2 className="mb-3 font-serif text-xl">{t.newCustomer}</h2>
          <CustomerForm t={t.form} messages={messages} onDone={(c) => router.push(`/staff/customers/${c.id}`)} />
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => setCreating(true)}>
          {t.newCustomer}
        </Button>
      )}
    </div>
  );
}

/** Edit a customer's basics, then the page reloads with them. */
export function CustomerEdit({
  t,
  messages,
  initial,
}: {
  t: CustomerTexts & { edit: string };
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
  initial: Parameters<typeof CustomerForm>[0]['initial'];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {t.edit}
      </Button>
    );
  }
  return (
    <div className="gg-card p-4">
      <CustomerForm
        t={t}
        messages={messages}
        initial={initial}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
