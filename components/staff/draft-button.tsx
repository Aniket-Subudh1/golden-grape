'use client';

import { FilePlus2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createDraftPurchase } from '@/modules/purchasing/actions';

/** "Draft order" for one supplier's reorder rows at the suggested quantities; opens it in the admin to send. */
export function DraftButton({
  supplier,
  lines,
  t,
}: {
  supplier: string;
  lines: { variant: string; unit: string | null; unitQty: number }[];
  t: { create: string; creating: string; error: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await createDraftPurchase(null, { supplier, lines });
          if (result.ok) router.push(`/admin/collections/purchaseOrders/${result.data.id}`);
          else toast.error(t.error);
        })
      }
    >
      <FilePlus2 className="h-4 w-4" />
      {pending ? t.creating : t.create}
    </Button>
  );
}
