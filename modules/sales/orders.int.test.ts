import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// signUpFromOrder signs the new account in (a cookie): outside a request there is no cookie jar.
vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }), headers: async () => new Headers() }));
import { model } from '@/lib/tx';
import { bookEvent, recordBookingPayment, recordBookingRefund, setBookingStatus } from '@/modules/events/service';
import { onHand } from '@/modules/inventory/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { transitionReservation } from './reservations';
import { signUpFromOrder } from '@/modules/customers/service';
import { paymentsOf } from '@/modules/payments/service';
import { setOrderBankAccount, checkOrderToken, historyOf, orderToken, type PlaceOrderInput, placeOrder, recordPayment, recordRefund, requestRefund, returnItems, slotCalendar, transition } from './service';

const payload = await getTestPayload();

// Tuesday 10 Nov 2026, 08:00 in Luxembourg. Every day is open 10:00–18:00 through the rules' own hours.
const NOW = new Date('2026-11-10T07:00:00Z');
const DATE = '2026-11-10';
const everyDay = Array.from({ length: 7 }, (_, day) => ({ day: String(day) as '0', open: '10:00' as const, close: '18:00' as const }));

let wine: Awaited<ReturnType<typeof makeVariant>>;
let dish: Awaited<ReturnType<typeof makeVariant>>;
let staff: Awaited<ReturnType<typeof makeStaff>>;

beforeAll(async () => {
  for (const [mode, capacity] of [['pickup', 2], ['delivery', 3], ['table', 10]] as const) {
    await payload.create({ collection: 'slotRules', data: { mode, intervalMin: 30, capacityPerSlot: capacity, leadTimeMin: 60, maxDaysAhead: 14, days: everyDay }, overrideAccess: true });
  }
  await payload.create({ collection: 'deliveryZones', data: { name: 'Bissen', postalCodes: ['7795'], feeCents: 500, minOrderCents: 3000, freeFromCents: 10000, active: true }, overrideAccess: true });
  wine = await makeVariant(payload, { onHand: 100, price: 1500, packaging: [6] });
  // A table pre-order holds only counter items (APPLUX audit 10 Nov, §1): a tracked one, so its stock can be checked.
  dish = await makeVariant(payload, { onHand: 100, price: 650, kind: 'snack', trackStock: true });
  staff = await makeStaff(payload, ['sales']);
});

const order = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: randomUUID(),
  mode: 'pickup',
  lines: [{ variant: wine.variant.id, qty: 2 }],
  date: DATE,
  time: '14:00',
  name: 'Ana Silva',
  email: 'ana@example.test',
  phone: '+352 621 000 000',
  payment: 'onsite',
  locale: 'pt',
  ...over,
});

const stock = async () => (await onHand(payload, [wine.variant.id]))[wine.variant.id];
const movementsOf = async (id: string) =>
  (await payload.find({ collection: 'stockMovements', where: { 'ref.value': { equals: id } }, sort: 'createdAt', limit: 0, depth: 0, overrideAccess: true })).docs;
const countOrders = async (key: string) => (await payload.count({ collection: 'orders', where: { idempotencyKey: { equals: key } }, overrideAccess: true })).totalDocs;

describe('placeOrder', () => {
  it('pickup paid on site: confirmed, priced on the server, sale movements with channel webshop and ref = the order (AC-02)', async () => {
    const before = await stock();
    const placed = await placeOrder(payload, order(), { now: NOW });
    const doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(doc).toMatchObject({ status: 'confirmed', mode: 'pickup', channel: 'webshop', stockPosted: true, locale: 'pt', slot: { date: DATE, from: '14:00', to: '14:30' } });
    expect(doc.number).toMatch(/^CMD-2026-\d{5}$/);
    expect(doc.totals).toMatchObject({ subtotalCents: 3000, deliveryCents: 0, totalCents: 3000 });
    expect(doc.payment).toMatchObject({ method: 'onsite', status: 'pending' });
    const moves = await movementsOf(placed.id);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: 'sale', qty: -2, channel: 'webshop', ref: { relationTo: 'orders', value: placed.id } });
    expect(await stock()).toBe(before - 2);
  });

  it('the same key twice, one after the other → one order, one set of movements, the same id (AC-03)', async () => {
    const input = order({ time: '15:00' });
    const first = await placeOrder(payload, input, { now: NOW });
    const second = await placeOrder(payload, input, { now: NOW });
    expect(second).toEqual({ ...first, created: false });
    expect(first.created).toBe(true);
    expect(await countOrders(input.idempotencyKey)).toBe(1);
    expect(await movementsOf(first.id)).toHaveLength(1);
  });

  it('the same key 5 times at once → one order, one set of movements (AC-03)', async () => {
    const before = await stock();
    const input = order({ time: '15:30' });
    const results = await parallel(5, () => placeOrder(payload, input, { now: NOW }));
    const ids = results.map((r) => (r.status === 'fulfilled' ? r.value.id : String(r.reason)));
    expect(new Set(ids).size).toBe(1);
    expect(results.filter((r) => r.status === 'fulfilled' && r.value.created)).toHaveLength(1);
    expect(await countOrders(input.idempotencyKey)).toBe(1);
    expect(await movementsOf(ids[0])).toHaveLength(1);
    expect(await stock()).toBe(before - 2);
  });

  it('the last place of a slot taken by two orders at once → one succeeds, the other gets CONFLICT (AC-05)', async () => {
    await placeOrder(payload, order({ time: '16:00' }), { now: NOW }); // capacity 2: one place left
    const results = await parallel(2, () => placeOrder(payload, order({ time: '16:00' }), { now: NOW }));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'CONFLICT', message: 'slotFull' });
    const day = (await slotCalendar(payload, 'pickup', NOW)).find((d) => d.date === DATE);
    expect(day?.slots.find((s) => s.from === '16:00')?.available).toBe(0);
  });

  it('a forged slot is refused: before the lead time, outside the hours, past the booking window', async () => {
    await expect(placeOrder(payload, order({ time: '08:30' }), { now: NOW })).rejects.toMatchObject({ message: 'slotUnavailable' });
    await expect(placeOrder(payload, order({ time: '19:00' }), { now: NOW })).rejects.toMatchObject({ message: 'slotUnavailable' });
    await expect(placeOrder(payload, order({ date: '2026-12-30' }), { now: NOW })).rejects.toMatchObject({ message: 'slotUnavailable' });
  });

  it('a transfer order keeps the default bank account; staff can choose another active one; a deactivated one is refused (APPLUX, 12 Nov)', async () => {
    const saved = await payload.updateGlobal({
      slug: 'BusinessSettings',
      overrideAccess: true,
      data: {
        business: {
          name: 'Golden Grape',
          street: '25 Zac Klengbousbierg',
          postalCode: '7795',
          city: 'Bissen',
          bankAccounts: [
            { holder: 'Golden Grape Sàrl', bankName: 'BCEE', iban: 'LU12 0010 0012 3456 7891', bic: 'BCEELULL', active: true, isDefault: false },
            { holder: 'Golden Grape Events', iban: 'BE68 5390 0754 7034', active: true, isDefault: true },
            { holder: 'Old account', iban: 'NL91 ABNA 0417 1643 00', active: false, isDefault: true },
          ],
        },
      } as never,
    });
    const read = (id: string) => payload.findByID({ collection: 'orders', id, overrideAccess: true, depth: 0 });
    const accounts = saved.business.bankAccounts ?? [];
    // One default only, never a deactivated one.
    expect(accounts.map((a) => a.isDefault)).toEqual([false, true, false]);
    const placed = await placeOrder(payload, order({ time: '16:30', payment: 'transfer' }), { now: NOW });
    expect((await read(placed.id)).payment?.bankAccount).toMatchObject({ holder: 'Golden Grape Events', iban: 'BE68 5390 0754 7034' });
    const changed = await setOrderBankAccount(payload, placed.id, accounts[0].id!, staff.id);
    expect(changed.payment?.bankAccount).toMatchObject({ holder: 'Golden Grape Sàrl', bankName: 'BCEE', bic: 'BCEELULL' });
    expect(changed.status).toBe('awaiting_payment');
    await expect(setOrderBankAccount(payload, placed.id, accounts[2].id!, staff.id)).rejects.toMatchObject({ code: 'VALIDATION' });
    // Paid on site: no bank account to choose.
    const onsite = await placeOrder(payload, order({ time: '17:00' }), { now: NOW });
    expect((await read(onsite.id)).payment?.bankAccount?.iban ?? null).toBeNull();
    await expect(setOrderBankAccount(payload, onsite.id, accounts[0].id!, staff.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    // A later change of the settings never alters what an order's customer was told.
    await payload.updateGlobal({ slug: 'BusinessSettings', overrideAccess: true, data: { business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen', bankAccounts: [] } } as never });
    expect((await read(placed.id)).payment?.bankAccount).toMatchObject({ holder: 'Golden Grape Sàrl' });
  });

  it('bank transfer → awaiting_payment, no stock; the full amount recorded → confirmed, stock posted, one payment row with date, reference and user (AC-08, GG-003)', async () => {
    const before = await stock();
    const placed = await placeOrder(payload, order({ payment: 'transfer', time: '11:00' }), { now: NOW });
    let doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(doc).toMatchObject({ status: 'awaiting_payment', stockPosted: false, payment: { status: 'pending' } });
    expect(await stock()).toBe(before);
    const at = new Date('2026-11-09T12:00:00Z');
    const result = await recordPayment(payload, placed.id, { amountCents: 3000, at, reference: 'BCEE-123', user: staff.id });
    expect(result.effects).toContain('mailCustomer');
    doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(doc).toMatchObject({ status: 'confirmed', stockPosted: true, payment: { status: 'paid', paidCents: 3000 } });
    expect(await stock()).toBe(before - 2);
    const pays = await paymentsOf(payload, placed.id);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ kind: 'charge', amountCents: 3000, provider: 'manual', reference: 'BCEE-123', user: staff.id });
    expect(new Date(pays[0].at!).toISOString()).toBe(at.toISOString());
  });

  it('delivery: outside every zone refused, below the minimum refused, otherwise the fee is in the total (AC-04)', async () => {
    const address = { line1: 'Rue Principale 1', postalCode: 'L-7795', city: 'Bissen' };
    const delivery = (over: Partial<PlaceOrderInput>) => order({ mode: 'delivery', payment: 'transfer', time: '12:00', address, ...over });
    await expect(placeOrder(payload, delivery({ address: { ...address, postalCode: '1009' } }), { now: NOW })).rejects.toMatchObject({ message: 'outsideZone' });
    await expect(placeOrder(payload, delivery({ lines: [{ variant: wine.variant.id, qty: 1 }] }), { now: NOW })).rejects.toMatchObject({ message: 'belowMinimum' });
    await expect(placeOrder(payload, delivery({ payment: 'onsite' }), { now: NOW })).rejects.toMatchObject({ message: 'invalid' });
    const placed = await placeOrder(payload, delivery({}), { now: NOW });
    const doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(doc.totals).toMatchObject({ subtotalCents: 3000, deliveryCents: 500, totalCents: 3500 });
    expect(doc.address).toMatchObject({ postalCode: 'L-7795', city: 'Bissen' });
  });

  it('more than the stock → refused before anything is written', async () => {
    const input = order({ time: '17:00', lines: [{ variant: wine.variant.id, qty: 500 }] });
    await expect(placeOrder(payload, input, { now: NOW })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
    expect(await countOrders(input.idempotencyKey)).toBe(0);
  });
});

describe('transition', () => {
  it('confirm then cancel → stock back to the start; cancel again → refused, stock unchanged (AC-02)', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ time: '12:30', lines: [{ variant: wine.variant.id, unit: wine.units[6], qty: 1 }] }), { now: NOW });
    expect(await stock()).toBe(start - 6);
    await transition(payload, placed.id, 'cancelled', { user: staff.id, reason: 'Client absent' });
    expect(await stock()).toBe(start);
    const moves = await movementsOf(placed.id);
    expect(moves.map((m) => [m.type, m.qty, m.unitQty])).toEqual([
      ['sale', -6, -1],
      ['cancel', 6, 1],
    ]);
    await expect(transition(payload, placed.id, 'cancelled', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(transition(payload, placed.id, 'confirmed', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await stock()).toBe(start);
    expect(await movementsOf(placed.id)).toHaveLength(2);
  });

  it('two staff cancelling at once → stock returned once', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ time: '13:00' }), { now: NOW });
    const results = await parallel(2, () => transition(payload, placed.id, 'cancelled', { user: staff.id }));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(start);
  });

  it('a pending transfer cancelled → no movements at all', async () => {
    const placed = await placeOrder(payload, order({ payment: 'transfer', time: '13:30' }), { now: NOW });
    await transition(payload, placed.id, 'cancelled', { user: staff.id });
    expect(await movementsOf(placed.id)).toHaveLength(0);
  });
});

describe('payments and refunds (GG-003, GG-004)', () => {
  const read = (id: string) => payload.findByID({ collection: 'orders', id, overrideAccess: true, depth: 0 });
  const AT = new Date('2026-11-09T12:00:00Z');
  // Their own day, so their slots never fill the other tests' ones.
  const DAY2 = '2026-11-11';

  it('"confirm without payment" on a transfer records no money: the order is confirmed, the payment still awaited', async () => {
    const placed = await placeOrder(payload, order({ date: DAY2, payment: 'transfer', time: '15:00' }), { now: NOW });
    await transition(payload, placed.id, 'confirmed', { user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'confirmed', stockPosted: true, payment: { status: 'pending', paidCents: 0 } });
    expect(await paymentsOf(payload, placed.id)).toHaveLength(0);
    // Handing it over does not invent the transfer either.
    await transition(payload, placed.id, 'completed', { user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'completed', payment: { status: 'pending' } });
    expect(await paymentsOf(payload, placed.id)).toHaveLength(0);
  });

  it('a deposit → partially paid, still waiting; the rest → paid and confirmed once; more than due → refused', async () => {
    const before = await stock();
    const placed = await placeOrder(payload, order({ date: DAY2, payment: 'transfer', time: '15:30' }), { now: NOW });
    await recordPayment(payload, placed.id, { amountCents: 1000, at: AT, user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'awaiting_payment', stockPosted: false, payment: { status: 'partial', paidCents: 1000 } });
    expect(await stock()).toBe(before);
    await expect(recordPayment(payload, placed.id, { amountCents: 2001, at: AT, user: staff.id })).rejects.toMatchObject({ message: 'amountTooHigh' });
    await recordPayment(payload, placed.id, { amountCents: 2000, at: AT, user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'confirmed', stockPosted: true, payment: { status: 'paid', paidCents: 3000 } });
    expect(await stock()).toBe(before - 2);
    await expect(recordPayment(payload, placed.id, { amountCents: 1, at: AT, user: staff.id })).rejects.toMatchObject({ message: 'amountTooHigh' });
    expect((await paymentsOf(payload, placed.id)).map((p) => p.amountCents)).toEqual([1000, 2000]);
  });

  it('two staff recording the full transfer at once → one payment row, never paid twice', async () => {
    const placed = await placeOrder(payload, order({ date: DAY2, payment: 'transfer', time: '16:00' }), { now: NOW });
    const results = await parallel(2, () => recordPayment(payload, placed.id, { amountCents: 3000, at: AT, user: staff.id }));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await paymentsOf(payload, placed.id)).toHaveLength(1);
    expect(await read(placed.id)).toMatchObject({ payment: { paidCents: 3000, status: 'paid' } });
  });

  it('a delivered order refunded: request → pending, nothing sent, no stock; part sent → partially refunded; rest → refunded; stock never moves', async () => {
    const placed = await placeOrder(payload, order({ date: DAY2, time: '16:30' }), { now: NOW });
    await transition(payload, placed.id, 'completed', { user: staff.id }); // paid on site at handover
    expect(await read(placed.id)).toMatchObject({ status: 'completed', payment: { status: 'paid', paidCents: 3000 } });
    const afterSale = await stock();
    const moves = (await movementsOf(placed.id)).length;

    await requestRefund(payload, placed.id, { amountCents: 3000, reason: 'Bouchon', user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'completed', payment: { status: 'refund_pending', refundDueCents: 3000, refundedCents: 0, refundReason: 'Bouchon' } });
    expect((await paymentsOf(payload, placed.id)).filter((p) => p.kind === 'refund')).toHaveLength(0);

    await recordRefund(payload, placed.id, { amountCents: 1000, at: AT, method: 'transfer', reason: 'Bouchon', reference: 'R1', user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'completed', payment: { status: 'refund_pending', refundedCents: 1000, refundDueCents: 2000 } });
    await expect(recordRefund(payload, placed.id, { amountCents: 2001, at: AT, method: 'transfer', reason: 'x', user: staff.id })).rejects.toMatchObject({ message: 'amountTooHigh' });
    const last = await recordRefund(payload, placed.id, { amountCents: 2000, at: AT, method: 'transfer', reason: 'Bouchon', user: staff.id });
    expect(last.effects).toContain('mailCustomer');
    expect(await read(placed.id)).toMatchObject({ status: 'refunded', payment: { status: 'refunded', refundedCents: 3000, refundDueCents: 0 } });

    const refunds = (await paymentsOf(payload, placed.id)).filter((p) => p.kind === 'refund');
    expect(refunds.map((p) => [p.amountCents, p.reason, p.user])).toEqual([
      [-1000, 'Bouchon', staff.id],
      [-2000, 'Bouchon', staff.id],
    ]);
    expect(await stock()).toBe(afterSale);
    expect(await movementsOf(placed.id)).toHaveLength(moves);
  });

  it('a partial refund on a handed-over order keeps it completed, "partially refunded"', async () => {
    const placed = await placeOrder(payload, order({ date: DAY2, time: '17:00' }), { now: NOW });
    await transition(payload, placed.id, 'completed', { user: staff.id });
    await requestRefund(payload, placed.id, { amountCents: 500, reason: 'Geste', user: staff.id });
    await recordRefund(payload, placed.id, { amountCents: 500, at: AT, method: 'onsite', reason: 'Geste', user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'completed', payment: { status: 'partially_refunded', refundedCents: 500 } });
  });

  it('a paid order cancelled before handover → stock back, the paid amount becomes a refund to send; "refunded" is never a staff move', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ date: DAY2, payment: 'transfer', time: '17:30' }), { now: NOW });
    await recordPayment(payload, placed.id, { amountCents: 3000, at: AT, user: staff.id });
    await expect(transition(payload, placed.id, 'refunded', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    await transition(payload, placed.id, 'cancelled', { user: staff.id, reason: 'Rupture' });
    expect(await stock()).toBe(start);
    expect(await read(placed.id)).toMatchObject({ status: 'cancelled', payment: { status: 'refund_pending', paidCents: 3000, refundDueCents: 3000, refundReason: 'Rupture' } });
    await recordRefund(payload, placed.id, { amountCents: 3000, at: AT, method: 'transfer', reason: 'Rupture', user: staff.id });
    expect(await read(placed.id)).toMatchObject({ status: 'cancelled', payment: { status: 'refunded' } });
    expect(await stock()).toBe(start);
  });
});

describe('reservations', () => {
  const table = (over: Partial<PlaceOrderInput> = {}) => order({ mode: 'table', time: '17:00', guests: 4, preorder: true, lines: [{ variant: dish.variant.id, qty: 2 }], ...over });
  const dishStock = async () => (await onHand(payload, [dish.variant.id]))[dish.variant.id];

  it('a shop product is never a table pre-order: refused, and neither a reservation nor an order is created (§1)', async () => {
    const before = await Promise.all(['reservations', 'orders'].map((c) => payload.count({ collection: c as 'orders', overrideAccess: true })));
    await expect(placeOrder(payload, table({ time: '16:00', lines: [{ variant: dish.variant.id, qty: 1 }, { variant: wine.variant.id, qty: 1 }] }), { now: NOW })).rejects.toMatchObject({
      message: 'notPreorderable',
    });
    const after = await Promise.all(['reservations', 'orders'].map((c) => payload.count({ collection: c as 'orders', overrideAccess: true })));
    expect(after.map((c) => c.totalDocs)).toEqual(before.map((c) => c.totalDocs));
  });

  it('a table with a pre-order waits as pending; the slot counts guests; no stock moves', async () => {
    const start = await dishStock();
    const placed = await placeOrder(payload, table(), { now: NOW });
    expect(placed.kind).toBe('reservation');
    const res = await payload.findByID({ collection: 'reservations', id: placed.id, overrideAccess: true, depth: 0 });
    expect(res).toMatchObject({ status: 'pending', guests: 4, slot: { date: DATE, from: '17:00' } });
    expect(res.number).toMatch(/^RES-2026-\d{5}$/);
    const pre = await payload.findByID({ collection: 'orders', id: String(res.preorder), overrideAccess: true, depth: 0 });
    expect(pre).toMatchObject({ status: 'pending', mode: 'table', stockPosted: false });
    expect(await dishStock()).toBe(start);
    // 10 guests per slot: 4 taken, 7 more do not fit.
    await expect(placeOrder(payload, table({ guests: 7, preorder: false, lines: [] }), { now: NOW })).rejects.toMatchObject({ message: 'slotFull' });
  });

  it('reject → no movements, no payment, the pre-order cancelled (AC-06)', async () => {
    const placed = await placeOrder(payload, table({ time: '10:30' }), { now: NOW });
    const { reservation, preorder } = await transitionReservation(payload, placed.id, 'rejected', { user: staff.id });
    expect(reservation.status).toBe('rejected');
    expect(preorder?.status).toBe('cancelled');
    expect(await movementsOf(preorder!.id)).toHaveLength(0);
    expect((await payload.count({ collection: 'payments', where: { order: { equals: preorder!.id } }, overrideAccess: true })).totalDocs).toBe(0);
  });

  it('accept → the pre-order is confirmed and its movements equal its lines', async () => {
    const start = await dishStock();
    const placed = await placeOrder(payload, table({ time: '11:30', lines: [{ variant: dish.variant.id, qty: 3 }] }), { now: NOW });
    const { preorder } = await transitionReservation(payload, placed.id, 'accepted', { user: staff.id });
    expect(preorder).toMatchObject({ status: 'confirmed', stockPosted: true });
    const moves = await movementsOf(preorder!.id);
    expect(moves.map((m) => [m.type, m.qty])).toEqual([['sale', -3]]);
    expect(await dishStock()).toBe(start - 3);
    await expect(transitionReservation(payload, placed.id, 'accepted', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('no-show (GG-019): only after accepting; the pre-order is cancelled and its stock back once; the reason is kept; nothing after it', async () => {
    const start = await dishStock();
    const placed = await placeOrder(payload, table({ time: '12:30', lines: [{ variant: dish.variant.id, qty: 2 }] }), { now: NOW });
    await expect(transitionReservation(payload, placed.id, 'no_show', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    await transitionReservation(payload, placed.id, 'accepted', { user: staff.id });
    expect(await dishStock()).toBe(start - 2);
    const { reservation, preorder } = await transitionReservation(payload, placed.id, 'no_show', { user: staff.id, reason: 'Pas de réponse au téléphone' });
    expect(reservation.status).toBe('no_show');
    expect(reservation.history?.at(-1)).toMatchObject({ from: 'accepted', to: 'no_show', reason: 'Pas de réponse au téléphone' });
    expect(preorder).toMatchObject({ status: 'cancelled', stockPosted: false });
    expect(await dishStock()).toBe(start);
    await expect(transitionReservation(payload, placed.id, 'cancelled', { user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('event bookings', () => {
  it('the last seat booked by two people at once → one success, the other sold out (AC-07)', async () => {
    const event = await payload.create({
      collection: 'events',
      data: { title: 'Noite de Fado', slug: 'fado', startsAt: '2030-01-10T19:00:00Z', priceCents: 0, capacity: 3, _status: 'published' },
      overrideAccess: true,
    });
    const book = (guests: number) =>
      bookEvent(payload, { idempotencyKey: randomUUID(), event: event.id, guests, name: 'Rui', email: 'rui@example.test', phone: '+352 1', locale: 'fr' });
    const first = await book(2);
    expect(first.booking.status).toBe('confirmed');
    const results = await parallel(2, () => book(1));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT', message: 'soldOut' });
    const stored = await model(payload, 'events').findById(event.id).lean<{ booked: number }>();
    expect(stored?.booked).toBe(3);
  });

  it('the same booking key twice → one booking', async () => {
    const event = await payload.create({
      collection: 'events',
      data: { title: 'Prova', slug: 'prova', startsAt: '2030-02-10T19:00:00Z', priceCents: 2500, capacity: 10, _status: 'published' },
      overrideAccess: true,
    });
    const input = { idempotencyKey: randomUUID(), event: event.id, guests: 2, name: 'Rui', email: 'rui@example.test', phone: '+352 1', locale: 'fr' as const };
    const results = await parallel(3, () => bookEvent(payload, input));
    expect(new Set(results.map((r) => (r.status === 'fulfilled' ? r.value.booking.id : 'x'))).size).toBe(1);
    expect((await model(payload, 'events').findById(event.id).lean<{ booked: number }>())?.booked).toBe(2);
    expect((results[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof bookEvent>>>).value.booking).toMatchObject({ status: 'pending', amountCents: 5000 });
  });

  it('payment received (APPLUX audit 10 Nov, §8): recorded with amount, day, method and who, the booking confirmed, once', async () => {
    const event = await payload.create({
      collection: 'events',
      data: { title: 'Noite de Fado', slug: 'fado-paid', startsAt: '2030-03-10T19:00:00Z', priceCents: 2400, capacity: 10, _status: 'published' },
      overrideAccess: true,
    });
    const { booking } = await bookEvent(payload, { idempotencyKey: randomUUID(), event: event.id, guests: 2, name: 'Hans Müller', email: 'hans@example.test', phone: '+352 621 123 456', locale: 'de' });
    expect(booking).toMatchObject({ status: 'pending', paymentStatus: 'pending', label: 'Noite de Fado · Hans Müller (2 places)' });
    const pay = () => recordBookingPayment(payload, booking.id, { amountCents: 4800, at: new Date('2026-11-10T12:00:00Z'), method: 'transfer', reference: 'FADO-2', user: staff.id });
    const results = await parallel(2, pay);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const stored = await payload.findByID({ collection: 'eventBookings', id: booking.id, depth: 0, overrideAccess: true });
    expect(stored).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', paidCents: 4800 });
    expect(stored.payments).toHaveLength(1);
    expect(stored.payments?.[0]).toMatchObject({ kind: 'charge', amountCents: 4800, method: 'transfer', reference: 'FADO-2', user: staff.id });
    expect(stored.payments?.[0].at?.slice(0, 10)).toBe('2026-11-10');
  });

  it('status and payment are separate (APPLUX report 4, §4): 100 € of 140 € leaves 40 € due; the rest pays it; refunds never exceed what came in', async () => {
    const event = await payload.create({
      collection: 'events',
      data: { title: 'Dîner vigneron', slug: 'diner-partial', startsAt: '2030-04-10T19:00:00Z', priceCents: 7000, capacity: 10, _status: 'published' },
      overrideAccess: true,
    });
    const { booking } = await bookEvent(payload, { idempotencyKey: randomUUID(), event: event.id, guests: 2, name: 'Ana Costa', email: 'ana@example.test', phone: '+352 621 123 456', locale: 'fr' });
    const pay = (amountCents: number) => recordBookingPayment(payload, booking.id, { amountCents, at: new Date('2026-11-12T12:00:00Z'), method: 'onsite', user: staff.id });
    const refund = (amountCents: number) => recordBookingRefund(payload, booking.id, { amountCents, at: new Date('2026-11-12T12:00:00Z'), method: 'transfer', reason: 'Client malade', user: staff.id });

    // A part payment: partly paid, 40 € due, and the booking still waits for staff.
    expect(await pay(10000)).toMatchObject({ confirmed: false, dueCents: 4000, booking: { status: 'pending', paymentStatus: 'partial', paidCents: 10000 } });
    // Confirmed while only partly paid.
    expect(await setBookingStatus(payload, booking.id, 'confirmed')).toMatchObject({ status: 'confirmed', paymentStatus: 'partial' });
    // More than what is due is refused; nothing changes.
    await expect(pay(4001)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await pay(4000)).toMatchObject({ confirmed: false, dueCents: 0, booking: { status: 'confirmed', paymentStatus: 'paid', paidCents: 14000 } });
    await expect(pay(1)).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(refund(14001)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await refund(4000)).toMatchObject({ booking: { status: 'confirmed', paymentStatus: 'partially_refunded', refundedCents: 4000 } });
    const done = await refund(10000);
    expect(done.booking).toMatchObject({ paymentStatus: 'refunded', refundedCents: 14000 });
    expect(done.booking.payments?.map((p) => p.amountCents)).toEqual([10000, 4000, -4000, -10000]);
    // No payment on a cancelled booking.
    await setBookingStatus(payload, booking.id, 'cancelled');
    await expect(pay(100)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a free booking is "free" and confirmed at once', async () => {
    const event = await payload.create({ collection: 'events', data: { title: 'Portes ouvertes', slug: 'free-event', startsAt: '2030-05-10T19:00:00Z', priceCents: 0, _status: 'published' }, overrideAccess: true });
    const { booking } = await bookEvent(payload, { idempotencyKey: randomUUID(), event: event.id, guests: 3, name: 'Rui', email: 'rui@example.test', phone: '+352 621 123 456', locale: 'pt' });
    expect(booking).toMatchObject({ status: 'confirmed', paymentStatus: 'free' });
  });
});

describe('who can see an order', () => {
  it('a guest token for order X does not open order Y', async () => {
    const x = await placeOrder(payload, order({ time: '10:00' }), { now: NOW });
    const y = await placeOrder(payload, order({ time: '10:00' }), { now: NOW });
    expect(checkOrderToken(x.id, orderToken(x.id))).toBe(true);
    expect(checkOrderToken(y.id, orderToken(x.id))).toBe(false);
    expect(checkOrderToken(y.id, '')).toBe(false);
    expect(checkOrderToken(y.id, `${orderToken(y.id)}x`)).toBe(false);
  });

  it('a customer reads only their own orders and reservations (deferred from M2.2)', async () => {
    const mk = async (name: string) => {
      const c = await payload.create({ collection: 'customers', data: { name, email: `${name}@example.test`, password: 'Customer-Password-1', type: 'private', locale: 'fr' }, overrideAccess: true });
      return { ...c, collection: 'customers' as const };
    };
    const a = await mk('carla');
    const b = await mk('diogo');
    const mine = await placeOrder(payload, order({ time: '17:30' }), { now: NOW, customer: a });
    const theirs = await placeOrder(payload, order({ time: '17:30' }), { now: NOW, customer: b });
    const history = await historyOf(payload, a);
    expect(history.orders.map((o) => o.id)).toEqual([mine.id]);
    await expect(payload.findByID({ collection: 'orders', id: theirs.id, overrideAccess: false, user: a })).rejects.toThrow();
    const { docs } = await payload.find({ collection: 'orders', overrideAccess: false, user: a, limit: 0 });
    expect(docs.map((d) => d.id)).toEqual([mine.id]);
    await expect(payload.update({ collection: 'orders', id: mine.id, data: { status: 'completed' }, overrideAccess: false, user: a })).rejects.toThrow();
  });
});

describe('an account from a guest order (GG-010)', () => {
  const DAY3 = '2026-11-12';
  const address = { line1: '36, Route de Roost', postalCode: '7795', city: 'Bissen' };

  it('needs the confirmation link; gives the account this order and its address; a second try is refused', async () => {
    const placed = await placeOrder(payload, order({ date: DAY3, mode: 'delivery', payment: 'transfer', time: '10:00', email: 'guest.one@example.test', address, lines: [{ variant: wine.variant.id, qty: 3 }] }), { now: NOW });
    const base = { id: placed.id, password: 'a-good-password', locale: 'fr' as const };
    await expect(signUpFromOrder(payload, { ...base, token: 'forged' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await payload.count({ collection: 'customers', where: { email: { equals: 'guest.one@example.test' } }, overrideAccess: true })).totalDocs).toBe(0);

    const customer = await signUpFromOrder(payload, { ...base, token: orderToken(placed.id) });
    expect(customer).toMatchObject({ email: 'guest.one@example.test', name: 'Ana Silva' });
    const doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(String(doc.customer)).toBe(customer.id);
    const saved = await payload.findByID({ collection: 'customers', id: customer.id, overrideAccess: true, depth: 0 });
    expect(saved.addresses).toMatchObject([{ line1: address.line1, postalCode: '7795', city: 'Bissen', isDefault: true }]);
    await expect(signUpFromOrder(payload, { ...base, token: orderToken(placed.id) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('an e-mail that already has an account → refused, the order stays a guest order', async () => {
    const placed = await placeOrder(payload, order({ date: DAY3, time: '10:30', email: 'guest.one@example.test' }), { now: NOW });
    await expect(signUpFromOrder(payload, { id: placed.id, token: orderToken(placed.id), password: 'a-good-password', locale: 'fr' })).rejects.toMatchObject({ message: 'emailTaken' });
    expect((await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 })).customer).toBeFalsy();
  });
});

describe('stock across the whole order life (GG-042)', () => {
  const DAY4 = '2026-11-13';
  const AT = new Date('2026-11-09T12:00:00Z');
  const sales = async (id: string) => (await movementsOf(id)).map((m) => [m.type, m.qty]);

  it('pickup: placed (paid on site) → out once; ready and handover move nothing more', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ date: DAY4, time: '10:00' }), { now: NOW });
    expect(await stock()).toBe(start - 2);
    await transition(payload, placed.id, 'ready', { user: staff.id });
    await transition(payload, placed.id, 'completed', { user: staff.id });
    expect(await stock()).toBe(start - 2);
    expect(await sales(placed.id)).toEqual([['sale', -2]]);
  });

  it('delivery: awaiting the transfer → nothing; paid → out once; on its way and delivered → nothing more', async () => {
    const start = await stock();
    const address = { line1: 'Rue Principale 1', postalCode: '7795', city: 'Bissen' };
    const placed = await placeOrder(payload, order({ date: DAY4, mode: 'delivery', payment: 'transfer', time: '12:00', address }), { now: NOW });
    expect(await stock()).toBe(start);
    await recordPayment(payload, placed.id, { amountCents: 3500, at: AT, user: staff.id });
    expect(await stock()).toBe(start - 2);
    await transition(payload, placed.id, 'out_for_delivery', { user: staff.id });
    await transition(payload, placed.id, 'completed', { user: staff.id });
    expect(await stock()).toBe(start - 2);
    expect(await sales(placed.id)).toEqual([['sale', -2]]);
  });

  it('confirmed without payment, then the transfer recorded → still one deduction', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ date: DAY4, payment: 'transfer', time: '10:30' }), { now: NOW });
    await transition(payload, placed.id, 'confirmed', { user: staff.id });
    await recordPayment(payload, placed.id, { amountCents: 3000, at: AT, user: staff.id });
    expect(await stock()).toBe(start - 2);
    expect(await sales(placed.id)).toEqual([['sale', -2]]);
  });

  it('goods brought back after handover: back in stock line by line, never more than sold, twice at once counted once; no money moves', async () => {
    const start = await stock();
    const placed = await placeOrder(payload, order({ date: DAY4, time: '11:00', lines: [{ variant: wine.variant.id, qty: 3 }] }), { now: NOW });
    await expect(returnItems(payload, placed.id, { lines: [{ id: 'x', qty: 1 }], reason: 'Bouchon', user: staff.id })).rejects.toMatchObject({ code: 'CONFLICT' }); // not handed over yet
    await transition(payload, placed.id, 'completed', { user: staff.id });
    const line = (await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 })).lines![0];
    expect(await stock()).toBe(start - 3);

    await returnItems(payload, placed.id, { lines: [{ id: line.id!, qty: 1 }], reason: 'Bouchon', user: staff.id });
    expect(await stock()).toBe(start - 2);
    await expect(returnItems(payload, placed.id, { lines: [{ id: line.id!, qty: 3 }], reason: 'x', user: staff.id })).rejects.toMatchObject({ message: 'tooManyReturned' });
    await expect(returnItems(payload, placed.id, { lines: [{ id: line.id!, qty: 0 }], reason: 'x', user: staff.id })).rejects.toMatchObject({ message: 'nothingReturned' });

    // The last 2 returned by two staff at once: only one succeeds.
    const both = await parallel(2, () => returnItems(payload, placed.id, { lines: [{ id: line.id!, qty: 2 }], reason: 'Retour', user: staff.id }));
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(start);
    expect((await sales(placed.id)).filter(([t]) => t === 'return')).toEqual([
      ['return', 1],
      ['return', 2],
    ]);
    expect(await paymentsOf(payload, placed.id)).toHaveLength(1); // the on-site payment at handover only
    const doc = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(doc.history?.filter((h) => h.to === 'returned')).toHaveLength(2);
  });
});
