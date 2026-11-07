import type { Tx } from '@/lib/tx';
import type { Order } from '@/payload-types';
import type { Movement, PaymentProvider } from '../provider';

// Phase 1: money changes hands outside the website. On site and on invoice confirm straight away (paid at pickup or
// later); a bank transfer waits until staff record it. Capture, void and refund only record what staff did.

async function record(tx: Tx, order: Order, kind: 'charge' | 'refund' | 'void', money: Partial<Movement> & { amountCents: number }) {
  await tx.req.payload.create({
    collection: 'payments',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: {
      order: order.id,
      provider: 'manual',
      kind,
      amountCents: money.amountCents,
      method: money.method ?? order.payment?.method ?? undefined,
      status: kind === 'charge' ? 'paid' : kind === 'refund' ? 'refunded' : 'voided',
      at: (money.at ?? new Date()).toISOString(),
      reference: money.reference,
      reason: money.reason,
      user: money.user,
    },
  });
}

export const manual: PaymentProvider = {
  async start(_tx, order) {
    return order.payment?.method === 'transfer' ? { status: 'awaiting_payment', paymentStatus: 'pending' } : { status: 'confirmed', paymentStatus: 'pending' };
  },
  capture: (tx, order, money) => record(tx, order, 'charge', money),
  void: (tx, order, user) => record(tx, order, 'void', { amountCents: 0, user }),
  refund: (tx, order, money) => record(tx, order, 'refund', { ...money, amountCents: -money.amountCents }),
};
