import type { Tx } from '@/lib/tx';
import type { Order } from '@/payload-types';
import type { PaymentProvider } from '../provider';

// Phase 1: money changes hands outside the website. On site and on invoice confirm straight away (paid at pickup or
// later); a bank transfer waits until staff see it arrive. Capture, void and refund only record what staff did.

async function record(tx: Tx, order: Order, kind: 'charge' | 'refund' | 'void', amountCents: number, user?: string) {
  await tx.req.payload.create({
    collection: 'payments',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: { order: order.id, provider: 'manual', kind, amountCents, method: order.payment?.method ?? undefined, status: kind === 'charge' ? 'paid' : kind === 'refund' ? 'refunded' : 'voided', user },
  });
}

export const manual: PaymentProvider = {
  async start(_tx, order) {
    return order.payment?.method === 'transfer' ? { status: 'awaiting_payment', paymentStatus: 'pending' } : { status: 'confirmed', paymentStatus: 'pending' };
  },
  capture: (tx, order, user) => record(tx, order, 'charge', order.totals?.totalCents ?? 0, user),
  void: (tx, order, user) => record(tx, order, 'void', 0, user),
  refund: (tx, order, amountCents, user) => record(tx, order, 'refund', -amountCents, user),
};
