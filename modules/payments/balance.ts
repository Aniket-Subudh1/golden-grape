// What an order's customer has paid and been paid back, from its payment rows (GG-003, GG-004). The `payments`
// collection is the record; the order keeps these figures and the state below so lists and e-mails can read them.
// Refund rows are stored negative (money going out); charges and captures positive.

export type PaymentRow = { kind?: string | null; amountCents?: number | null };
export type PaymentState = 'pending' | 'partial' | 'paid' | 'refund_pending' | 'partially_refunded' | 'refunded';

export function sums(rows: PaymentRow[]) {
  let paidCents = 0;
  let refundedCents = 0;
  for (const r of rows) {
    if (r.kind === 'charge' || r.kind === 'capture') paidCents += r.amountCents ?? 0;
    else if (r.kind === 'refund') refundedCents += -(r.amountCents ?? 0);
  }
  return { paidCents, refundedCents };
}

export type Figures = { totalCents: number; paidCents: number; refundedCents: number; refundDueCents: number };

/** Still to receive from the customer. */
export const dueOf = (f: Figures) => Math.max(0, f.totalCents - f.paidCents);
/** What may still be paid back: money received and not yet refunded. */
export const refundableOf = (f: Figures) => Math.max(0, f.paidCents - f.refundedCents);

/**
 * The payment state shown to staff. A refund asked for and not yet sent wins (it is money owed); then what went
 * back; then what came in. Nothing is "paid" until a payment row says the money arrived.
 */
export function paymentState(f: Figures): PaymentState {
  if (f.refundDueCents > 0) return 'refund_pending';
  if (f.refundedCents > 0) return f.refundedCents >= f.paidCents ? 'refunded' : 'partially_refunded';
  if (f.paidCents > 0) return f.paidCents >= f.totalCents ? 'paid' : 'partial';
  return 'pending';
}
