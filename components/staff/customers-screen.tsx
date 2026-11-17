'use client';

import { ChevronRight, Pencil, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { CustomerForm, type CustomerTexts, type PickedCustomer } from './customer-form';
import { CustomerSearch } from './customer-search';
import { Empty } from './tabs';

type Messages = { error: string; fields: Record<string, string> } & Record<string, unknown>;
type Badges = { privateBadge: string; businessBadge: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** A customer at a glance: initials, the name (or company), the contact person and phone, private or business. */
export function CustomerRow({ c, t, trailing }: { c: PickedCustomer; t: Badges; trailing?: React.ReactNode }) {
  const business = c.type === 'business';
  return (
    <span className="flex w-full items-center gap-3 text-left">
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold',
          business ? 'bg-ink text-white' : 'bg-champagne text-gold-deep',
        )}
      >
        {initials(c.company || c.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{c.company || c.name}</span>
        <span className="text-ink/55 block truncate text-xs">
          {[c.company ? c.name : null, c.phone].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="text-ink/60 hidden rounded-full bg-[#e7ecf3] px-2 py-0.5 text-[11px] font-medium sm:inline">
        {business ? t.businessBadge : t.privateBadge}
      </span>
      {trailing}
    </span>
  );
}

/**
 * The customer form in a pop-up (a bottom sheet on phones, a dialog from tablets up): new customer at the till or on
 * the customers screen, or edit one. `onDone` gets the saved customer.
 */
export function CustomerSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  t,
  messages,
  initial,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  t: CustomerTexts;
  messages: Messages;
  initial?: Parameters<typeof CustomerForm>[0]['initial'];
  onDone: Parameters<typeof CustomerForm>[0]['onDone'];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} label={title} closeLabel={closeLabel} variant="bottom">
      <div className="p-5 pt-6 md:p-6">
        <h2 className="mb-5 pr-10 text-xl">{title}</h2>
        {/* Mounted only while open: a new customer starts from an empty form each time. */}
        {open && <CustomerForm t={t} messages={messages} initial={initial} onDone={onDone} />}
      </div>
    </Sheet>
  );
}

type ScreenTexts = Badges & {
  search: { search: string; placeholder: string; none: string };
  form: CustomerTexts;
  newCustomer: string;
  recent: string;
  noCustomers: string;
  cancel: string;
};

/** Find a customer (the most recent are listed until you type), or add one in a pop-up, then open their page. */
export function CustomersScreen({
  t,
  messages,
  recent,
}: {
  t: ScreenTexts;
  messages: Messages;
  recent: PickedCustomer[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const row = (c: PickedCustomer) => (
    <Link href={`/staff/customers/${c.id}`} className="gg-card block px-4 py-3 transition hover:shadow-md">
      <CustomerRow c={c} t={t} trailing={<ChevronRight className="text-ink/35 h-4 w-4 shrink-0" />} />
    </Link>
  );
  return (
    <div className="space-y-5 pb-16 md:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <CustomerSearch
            t={t.search}
            render={row}
            fallback={
              <section className="space-y-2">
                <h2 className="eyebrow text-ink/55 pt-2">{t.recent}</h2>
                {recent.length === 0 ? (
                  <Empty icon={<Users />} text={t.noCustomers} />
                ) : (
                  <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {recent.map((c) => (
                      <li key={c.id}>{row(c)}</li>
                    ))}
                  </ul>
                )}
              </section>
            }
          />
        </div>
      </div>
      <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 md:static md:right-auto md:bottom-auto">
        <Button type="button" onClick={() => setCreating(true)} className="shadow-lg md:shadow-none">
          <UserPlus className="h-4 w-4" />
          {t.newCustomer}
        </Button>
      </div>
      <CustomerSheet
        open={creating}
        onOpenChange={setCreating}
        title={t.newCustomer}
        closeLabel={t.cancel}
        t={t.form}
        messages={messages}
        onDone={(c) => {
          setCreating(false);
          router.push(`/staff/customers/${c.id}`);
        }}
      />
    </div>
  );
}

/** "Edit" on a customer's page: the form in a pop-up, then the page reloads with the new details. */
export function CustomerEdit({
  t,
  messages,
  initial,
}: {
  t: CustomerTexts & { edit: string; cancel: string };
  messages: Messages;
  initial: Parameters<typeof CustomerForm>[0]['initial'];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        {t.edit}
      </Button>
      <CustomerSheet
        open={open}
        onOpenChange={setOpen}
        title={t.edit}
        closeLabel={t.cancel}
        t={t}
        messages={messages}
        initial={initial}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
