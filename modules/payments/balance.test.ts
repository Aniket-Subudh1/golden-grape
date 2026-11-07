import { describe, expect, it } from 'vitest';
import { dueOf, type Figures, paymentState, refundableOf, sums } from './balance';

const f = (over: Partial<Figures>): Figures => ({ totalCents: 5000, paidCents: 0, refundedCents: 0, refundDueCents: 0, ...over });

describe('sums', () => {
  it('adds charges and captures as paid, refunds (stored negative) as refunded, ignores voids and authorisations', () => {
    expect(
      sums([
        { kind: 'charge', amountCents: 2000 },
        { kind: 'capture', amountCents: 3000 },
        { kind: 'refund', amountCents: -1500 },
        { kind: 'void', amountCents: 0 },
        { kind: 'authorization', amountCents: 5000 },
      ]),
    ).toEqual({ paidCents: 5000, refundedCents: 1500 });
  });
  it('no rows: nothing paid', () => expect(sums([])).toEqual({ paidCents: 0, refundedCents: 0 }));
});

describe('paymentState', () => {
  it.each([
    ['nothing received', f({}), 'pending'],
    ['a deposit', f({ paidCents: 1000 }), 'partial'],
    ['the full amount', f({ paidCents: 5000 }), 'paid'],
    ['more than the total', f({ paidCents: 5200 }), 'paid'],
    ['a refund asked, not sent', f({ paidCents: 5000, refundDueCents: 5000 }), 'refund_pending'],
    ['a refund asked after part was sent', f({ paidCents: 5000, refundedCents: 2000, refundDueCents: 3000 }), 'refund_pending'],
    ['part sent back', f({ paidCents: 5000, refundedCents: 2000 }), 'partially_refunded'],
    ['all sent back', f({ paidCents: 5000, refundedCents: 5000 }), 'refunded'],
    ['a deposit sent back in full', f({ paidCents: 1000, refundedCents: 1000 }), 'refunded'],
  ] as const)('%s → %s', (_, figures, expected) => expect(paymentState(figures)).toBe(expected));
});

describe('due and refundable', () => {
  it('due is what is left to receive, never negative', () => {
    expect(dueOf(f({ paidCents: 1500 }))).toBe(3500);
    expect(dueOf(f({ paidCents: 6000 }))).toBe(0);
  });
  it('refundable is what came in minus what went back', () => {
    expect(refundableOf(f({ paidCents: 5000, refundedCents: 2000 }))).toBe(3000);
    expect(refundableOf(f({}))).toBe(0);
  });
});
