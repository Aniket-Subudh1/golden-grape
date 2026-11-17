'use client';

import { useRouter } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { startStockCount } from '@/modules/inventory/actions';

/** "New count" with an optional name (a shelf, the cellar), then straight into scanning it. */
export function StartCount({ t, messages }: { t: { name: string; placeholder: string; start: string; pending: string }; messages: { error: string; fields: Record<string, string> } }) {
  const router = useRouter();
  return (
    <ActionForm action={startStockCount} messages={messages} onSuccess={({ id }) => router.push(`/staff/count/${id}`)} className="space-y-4 rounded-xl border border-border bg-white/70 p-4">
      <Field label={t.name} name="note" placeholder={t.placeholder} />
      <SubmitButton label={t.start} pendingLabel={t.pending} className="w-full" />
    </ActionForm>
  );
}
