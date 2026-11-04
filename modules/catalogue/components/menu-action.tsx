'use client';

import { Plus } from 'lucide-react';
import { QtyStepper } from '@/components/site/qty-stepper';
import { Button } from '@/components/ui/button';
import { useCart } from '@/modules/webshop/cart';

/** "Add" on a counter card, which becomes a stepper once the dish is in the cart (prototype MenuCard). */
export function MenuAction({ variant, label, steps, disabled, soldOut }: { variant: string; label: string; steps: { minus: string; plus: string }; disabled?: boolean; soldOut: string }) {
  const { qtyOf, setQty } = useCart();
  const qty = qtyOf(variant);
  if (disabled) {
    return (
      <Button className="w-full" disabled>
        {soldOut}
      </Button>
    );
  }
  if (qty === 0) {
    return (
      <Button className="w-full" onClick={() => setQty({ variant }, 1)}>
        <Plus className="h-3.5 w-3.5" /> {label}
      </Button>
    );
  }
  return <QtyStepper size="lg" value={qty} onChange={(n) => setQty({ variant }, n)} labels={steps} />;
}
