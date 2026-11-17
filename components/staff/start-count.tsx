'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { startStockCount } from '@/modules/inventory/actions';

/** "New count" in a pop-up: an optional name (a shelf, the cellar), then straight into scanning it. */
export function StartCount({
  t,
  messages,
}: {
  t: { name: string; placeholder: string; start: string; pending: string; hint: string; cancel: string };
  messages: { error: string; fields: Record<string, string> };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t.start}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} label={t.start} closeLabel={t.cancel} variant="bottom">
        <div className="p-5 pt-6 md:p-6">
          <h2 className="mb-1 pr-10 text-xl">{t.start}</h2>
          <p className="text-ink/60 mb-5 text-sm">{t.hint}</p>
          {open && (
            <ActionForm
              action={startStockCount}
              messages={messages}
              onSuccess={({ id }) => {
                setOpen(false);
                router.push(`/staff/count/${id}`);
              }}
              className="space-y-4"
            >
              <Field look="box" label={t.name} name="note" placeholder={t.placeholder} autoFocus />
              <SubmitButton label={t.start} pendingLabel={t.pending} className="w-full" />
            </ActionForm>
          )}
        </div>
      </Sheet>
    </>
  );
}
