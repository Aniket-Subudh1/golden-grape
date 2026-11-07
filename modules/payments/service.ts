import type { Payload } from 'payload';

// Read side of payments, for the order panel and the confirmation page, and the balance rules (balance.ts).

export { dueOf, paymentState, refundableOf, sums, type Figures, type PaymentState } from './balance';

/** The payment rows of an order, oldest first. */
export async function paymentsOf(payload: Payload, order: string) {
  const { docs } = await payload.find({ collection: 'payments', where: { order: { equals: order } }, sort: 'createdAt', limit: 0, depth: 0, overrideAccess: true });
  return docs;
}
