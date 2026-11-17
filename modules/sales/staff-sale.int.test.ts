import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

// The customer helpers import next/headers (the website session); outside a request there is none.
vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }), headers: async () => new Headers() }));
import { createCustomerByStaff, hasNoEmail } from '@/modules/customers/service';
import { onHand, rebuildStock } from '@/modules/inventory/service';
import { paymentsOf } from '@/modules/payments/service';
import { salesSummary } from '@/modules/reporting/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { placeStaffOrder } from './service';

// M3.1 T7: a sale made on the phone is the website's order on the mobile channel: priced by quote, numbered, stock out
// with the staff member and the channel on every movement, counted on its own day.

const payload = await getTestPayload();
const staff = await makeStaff(payload, ['sales']);
const wine = await makeVariant(payload, { onHand: 30, price: 1500, packaging: [6] });
const customer = await createCustomerByStaff(payload, { name: 'Ana Silva', phone: '+352 621 000 111', type: 'private', locale: 'pt' });
const company = await createCustomerByStaff(payload, { name: 'Rui Costa', phone: '+352 621 000 222', email: 'rui@restaurante.test', type: 'business', company: 'Restaurante Lisboa', locale: 'fr' });
const NOW = new Date('2026-11-17T14:05:00Z'); // 15:05 in Luxembourg

describe('placeStaffOrder', () => {
  it('paid on site: mobile order, completed (handed over) and paid, movements with channel mobile and user = staff', async () => {
    const placed = await placeStaffOrder(payload, { idempotencyKey: randomUUID(), customer: customer.id, lines: [{ variant: wine.variant.id, qty: 2 }], payment: 'onsite' }, { staff: staff.id, now: NOW });
    const order = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(order).toMatchObject({ channel: 'mobile', mode: 'instore', status: 'completed', staff: staff.id, customer: customer.id, slot: { date: '2026-11-17', from: '15:05' }, slotAt: '2026-11-17T15:05', locale: 'pt' });
    expect(order.number).toMatch(/^CMD-2026-\d{5}$/);
    expect(order.totals?.totalCents).toBe(3000);
    expect(order.payment).toMatchObject({ method: 'onsite', status: 'paid', paidCents: 3000 });
    expect(order.history?.map((h) => h.to)).toEqual(['payment', 'completed']);
    const payments = await paymentsOf(payload, order.id);
    expect(payments.map((p) => [p.kind, p.amountCents, p.method])).toEqual([['charge', 3000, 'onsite']]);
    const { docs } = await payload.find({ collection: 'stockMovements', where: { 'ref.value': { equals: order.id } }, overrideAccess: true, depth: 0 });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ type: 'sale', qty: -2, channel: 'mobile', user: staff.id });
  });

  it('invoice later for a business: a b2b order, confirmed and unpaid, stock out, a box takes its factor', async () => {
    const before = (await onHand(payload, [wine.variant.id]))[wine.variant.id];
    const placed = await placeStaffOrder(payload, { idempotencyKey: randomUUID(), customer: company.id, lines: [{ variant: wine.variant.id, unit: wine.units[6], qty: 1 }], payment: 'invoice' }, { staff: staff.id, now: NOW });
    const order = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(order).toMatchObject({ mode: 'b2b', status: 'confirmed', payment: { method: 'invoice', status: 'pending' }, contact: { name: 'Restaurante Lisboa' } });
    expect(order.payment?.paidCents ?? 0).toBe(0);
    expect((await onHand(payload, [wine.variant.id]))[wine.variant.id]).toBe(before - 6);
  });

  it('counts in the sales figures on the day of the sale', async () => {
    const summary = await salesSummary(payload, { from: '2026-11-17', to: '2026-11-17' });
    expect(summary.orders).toBe(2);
    expect(summary.grossCents).toBe(3000 + 6 * 1500);
  });

  it('the same key twice at once → one order, one set of movements', async () => {
    const key = randomUUID();
    const before = (await onHand(payload, [wine.variant.id]))[wine.variant.id];
    const results = await parallel(3, () => placeStaffOrder(payload, { idempotencyKey: key, customer: customer.id, lines: [{ variant: wine.variant.id, qty: 1 }], payment: 'onsite' }, { staff: staff.id, now: NOW }));
    const ids = new Set(results.map((r) => (r.status === 'fulfilled' ? r.value.id : 'rejected')));
    expect([...ids]).toHaveLength(1);
    expect((await onHand(payload, [wine.variant.id]))[wine.variant.id]).toBe(before - 1);
  });

  it('more than the stock → refused, nothing written', async () => {
    const small = await makeVariant(payload, { onHand: 1, price: 900 });
    const { totalDocs } = await payload.count({ collection: 'orders', overrideAccess: true });
    await expect(placeStaffOrder(payload, { idempotencyKey: randomUUID(), customer: customer.id, lines: [{ variant: small.variant.id, qty: 2 }], payment: 'onsite' }, { staff: staff.id, now: NOW })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
    expect((await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs).toBe(totalDocs);
    expect(await rebuildStock(payload)).toEqual([]);
  });
});

describe('customers created at the till (A-16)', () => {
  it('without an e-mail: a placeholder that never receives mail and cannot sign in', async () => {
    expect(hasNoEmail(customer.email)).toBe(true);
    await expect(payload.login({ collection: 'customers', data: { email: customer.email, password: 'anything-at-all' }, overrideAccess: true })).rejects.toThrow();
  });
  it('a known e-mail is refused', async () => {
    await expect(createCustomerByStaff(payload, { name: 'Copy', phone: '+352 621 000 333', email: 'RUI@restaurante.test', type: 'private', locale: 'fr' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
