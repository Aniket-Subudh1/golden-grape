import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { add } from '@/lib/money';
import { model } from '@/lib/tx';
import { getTestPayload } from '@/tests/helpers';
import { cashSummary, outstanding, SOLD, salesOverview, salesSummary } from './service';

const payload = await getTestPayload();

let n = 0;
/** An order as the sales module stores it; only the fields the figures read matter here. */
const order = (date: string, status: string, totalCents: number, vatCents: number, refundedCents = 0) => {
  n += 1;
  return {
    number: `CMD-2026-${String(n).padStart(5, '0')}`,
    status,
    channel: 'webshop',
    mode: 'pickup',
    idempotencyKey: randomUUID(),
    contact: { name: 'Ana Silva', email: 'ana@example.test', phone: '+352 621 000 000' },
    locale: 'fr',
    slot: { date, from: '14:00', to: '14:30' },
    slotAt: `${date}T14:00`,
    totals: { subtotalCents: totalCents, discountCents: 0, deliveryCents: 0, vatCents, totalCents },
    payment: { provider: 'manual', method: 'onsite', status: refundedCents ? 'partially_refunded' : 'paid', paidCents: totalCents, refundedCents, refundDueCents: 0 },
  };
};

beforeAll(async () => {
  await model(payload, 'orders').insertMany([
    order('2026-11-09', 'completed', 8450, 1228),
    order('2026-11-09', 'confirmed', 12900, 1874),
    order('2026-11-09', 'ready', 4600, 668),
    order('2026-11-09', 'out_for_delivery', 3000, 436),
    order('2026-11-09', 'completed', 23500, 3415, 3500), // partly refunded: 3 500 back, 509 VAT with it
    order('2026-11-09', 'pending', 7800, 1133), // not sold yet
    order('2026-11-09', 'awaiting_payment', 32000, 4650),
    order('2026-11-09', 'cancelled', 9900, 1438),
    order('2026-11-09', 'refunded', 9000, 1308, 9000),
    order('2026-11-08', 'completed', 18900, 2746), // yesterday
    order('2026-11-01', 'completed', 6600, 959), // earlier this month
    order('2026-10-31', 'completed', 5000, 727), // last month, after the 9th: outside "same days"
    order('2026-10-09', 'completed', 4000, 581), // last month, inside
    order('2026-11-10', 'confirmed', 9999, 1453), // tomorrow
  ]);
});

/** What the admin's order list shows for the same range and statuses: each order's total less what was refunded. */
async function listed(from: string, to: string) {
  const { docs } = await payload.find({
    collection: 'orders',
    where: { and: [{ 'slot.date': { greater_than_equal: from } }, { 'slot.date': { less_than_equal: to } }, { status: { in: [...SOLD] } }] },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  return { orders: docs.length, grossCents: add(...docs.map((d) => (d.totals?.totalCents ?? 0) - (d.payment?.refundedCents ?? 0))) };
}

describe('salesSummary', () => {
  it.each([
    ['one day', '2026-11-09', '2026-11-09'],
    ['the month so far', '2026-11-01', '2026-11-09'],
    ['across two months', '2026-10-01', '2026-11-30'],
    ['a day without sales', '2026-11-05', '2026-11-05'],
  ])('%s: equals the order list for the same range (AC-M3.3-06)', async (_, from, to) => {
    const summary = await salesSummary(payload, { from, to });
    expect({ orders: summary.orders, grossCents: summary.grossCents }).toEqual(await listed(from, to));
  });

  it('one day: sold statuses only, the partial refund deducted with its VAT share', async () => {
    expect(await salesSummary(payload, { from: '2026-11-09', to: '2026-11-09' })).toEqual({
      orders: 5,
      grossCents: 8450 + 12900 + 4600 + 3000 + 23500 - 3500,
      vatCents: 1228 + 1874 + 668 + 436 + 3415 - 509,
      netCents: 48950 - 7112,
      refundedCents: 3500,
      averageCents: 9790,
    });
  });
});

describe('salesOverview', () => {
  it('today, yesterday, month to date and the same days of last month', async () => {
    // 9 Nov 2026, 12:00 in Luxembourg.
    const o = await salesOverview(payload, new Date('2026-11-09T11:00:00Z'));
    expect(o.today).toMatchObject({ orders: 5, grossCents: 48950 });
    expect(o.yesterday).toMatchObject({ orders: 1, grossCents: 18900 });
    expect(o.month).toMatchObject({ orders: 7, grossCents: 48950 + 18900 + 6600 });
    expect(o.lastMonth).toMatchObject({ orders: 1, grossCents: 4000 });
  });
});

describe('money received and still owed (QA 12 Nov, GG-21)', () => {
  // Their own days (December), so the sales figures above never see these orders.
  beforeAll(async () => {
    const [onsite, partial, waiting] = [
      { ...order('2026-12-05', 'confirmed', 16500, 1650), payment: { provider: 'manual', method: 'onsite', status: 'pending', paidCents: 0 } }, // a table pre-order to pay on site
      { ...order('2026-12-05', 'completed', 2550, 371), payment: { provider: 'manual', method: 'transfer', status: 'partial', paidCents: 1000 } }, // handed over, 15,50 € still due
      { ...order('2026-12-05', 'awaiting_payment', 4000, 581), payment: { provider: 'manual', method: 'transfer', status: 'pending', paidCents: 0 } }, // not sold yet
    ];
    const ids = (await model(payload, 'orders').insertMany([onsite, partial, waiting])).map((o) => o._id);
    const pay = (kind: string, amountCents: number, at: string) => ({ order: ids[1], provider: 'manual', kind, amountCents, status: 'paid', at: new Date(at), method: 'transfer' });
    await model(payload, 'payments').insertMany([
      pay('charge', 1000, '2026-12-05T11:00:00Z'),
      pay('charge', 1550, '2026-12-05T22:30:00Z'), // 23:30 in Luxembourg: still 5 December
      pay('refund', -500, '2026-12-04T23:30:00Z'), // 00:30 in Luxembourg: already 5 December
      pay('charge', 999, '2026-12-05T23:30:00Z'), // 00:30 on 6 December: another day
      pay('void', 0, '2026-12-05T12:00:00Z'),
    ]);
  });

  it('received and refunded by the Luxembourg day of the payment', async () => {
    expect(await cashSummary(payload, { from: '2026-12-05', to: '2026-12-05' })).toEqual({ receivedCents: 2550, refundedCents: 500, netCents: 2050 });
    expect(await cashSummary(payload, { from: '2026-12-01', to: '2026-12-31' })).toEqual({ receivedCents: 3549, refundedCents: 500, netCents: 3049 });
    expect(await cashSummary(payload, { from: '2026-12-07', to: '2026-12-07' })).toEqual({ receivedCents: 0, refundedCents: 0, netCents: 0 });
  });

  it('still owed: sold orders not fully paid, never an order still waiting to be confirmed', async () => {
    expect(await outstanding(payload)).toEqual({ orders: 2, dueCents: 16500 + 1550 });
  });
});
