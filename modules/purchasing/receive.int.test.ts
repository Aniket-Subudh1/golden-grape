import { describe, expect, it } from 'vitest';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { onHand, rebuildStock } from '@/modules/inventory/service';
import { receive } from './service';

// M3.1 T7: receiving a purchase order moves stock in base units, in one transaction with the order and the cost.

const payload = await getTestPayload();
const stock = await makeStaff(payload, ['stock']);
const manager = await makeStaff(payload, ['manager']);
const supplier = await payload.create({ collection: 'suppliers', data: { name: 'Quinta Teste' }, overrideAccess: true });

async function orderOf(lines: { variant: string; unit?: string; unitQty: number; costCents?: number }[], status: 'draft' | 'ordered' = 'ordered') {
  return payload.create({ collection: 'purchaseOrders', data: { supplier: supplier.id, status, lines }, overrideAccess: true, depth: 0 });
}

describe('receive', () => {
  it('2 × box of 12 at 120.00 → +24 bottles, received, cost 10.00 a bottle, movements in the ledger', async () => {
    const { variant, units } = await makeVariant(payload, { packaging: [12] });
    const po = await orderOf([{ variant: variant.id, unit: units[12], unitQty: 2, costCents: 12000 }]);
    expect(po.number).toMatch(/^BCF-\d{4}-\d{5}$/);
    const { order } = await receive(payload, po.id, [{ variant: variant.id, unit: units[12], unitQty: 2 }], { user: stock.id, manager: false });
    expect(order.status).toBe('received');
    expect(order.lines?.[0].receivedUnitQty).toBe(2);
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(24);
    const v = await payload.findByID({ collection: 'variants', id: variant.id, overrideAccess: true });
    expect(v.costCents).toBe(1000);
    const { docs } = await payload.find({ collection: 'stockMovements', where: { variant: { equals: variant.id } }, overrideAccess: true, depth: 0 });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ qty: 24, unitQty: 2, type: 'receipt', channel: 'mobile', user: stock.id, ref: { relationTo: 'purchaseOrders', value: po.id } });
  });

  it('a partial receipt of 1 box → partly_received, +12; the rest later → received', async () => {
    const { variant, units } = await makeVariant(payload, { packaging: [12] });
    const po = await orderOf([{ variant: variant.id, unit: units[12], unitQty: 2, costCents: 12000 }]);
    const first = await receive(payload, po.id, [{ variant: variant.id, unit: units[12], unitQty: 1 }], { user: stock.id, manager: false });
    expect(first.order.status).toBe('partly_received');
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(12);
    const second = await receive(payload, po.id, [{ variant: variant.id, unit: units[12], unitQty: 1 }], { user: stock.id, manager: false });
    expect(second.order.status).toBe('received');
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(24);
  });

  it('more than remains: refused without a reason (nothing moves), accepted with one', async () => {
    const { variant } = await makeVariant(payload);
    const po = await orderOf([{ variant: variant.id, unitQty: 6, costCents: 900 }]);
    await expect(receive(payload, po.id, [{ variant: variant.id, unitQty: 7 }], { user: stock.id, manager: false })).rejects.toMatchObject({ code: 'VALIDATION', message: 'overReceipt' });
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(0);
    const { order } = await receive(payload, po.id, [{ variant: variant.id, unitQty: 7, reason: 'Une bouteille offerte' }], { user: stock.id, manager: false });
    expect(order.status).toBe('received');
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(7);
  });

  it('a size not on the order: refused to stock staff, added to the order by a manager', async () => {
    const { variant } = await makeVariant(payload);
    const { variant: other } = await makeVariant(payload);
    await payload.create({ collection: 'supplierProducts', data: { supplier: supplier.id, variant: other.id, costCents: 450 }, overrideAccess: true });
    const po = await orderOf([{ variant: variant.id, unitQty: 3, costCents: 500 }]);
    await expect(receive(payload, po.id, [{ variant: other.id, unitQty: 2 }], { user: stock.id, manager: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const { order } = await receive(payload, po.id, [{ variant: other.id, unitQty: 2 }], { user: manager.id, manager: true });
    expect(order.lines).toHaveLength(2);
    expect(order.lines?.[1]).toMatchObject({ unitQty: 2, receivedUnitQty: 2, costCents: 450 });
    expect(order.status).toBe('partly_received'); // the 3 ordered are still to come
    expect((await onHand(payload, [other.id]))[other.id]).toBe(2);
  });

  it('only ordered or partly received orders take goods', async () => {
    const { variant } = await makeVariant(payload);
    const draft = await orderOf([{ variant: variant.id, unitQty: 1, costCents: 100 }], 'draft');
    expect(draft.number).toBeFalsy();
    await expect(receive(payload, draft.id, [{ variant: variant.id, unitQty: 1 }], { user: stock.id, manager: false })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('two receipts of the last box at once: one counts it, the other needs a reason (no double count)', async () => {
    const { variant } = await makeVariant(payload);
    const po = await orderOf([{ variant: variant.id, unitQty: 1, costCents: 100 }]);
    const results = await parallel(2, () => receive(payload, po.id, [{ variant: variant.id, unitQty: 1 }], { user: stock.id, manager: false }));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(1);
    expect(await rebuildStock(payload)).toEqual([]);
  });
});

describe('purchase orders edited in the admin', () => {
  it('numbers are given on leaving draft, gapless, never on a draft', async () => {
    const { variant } = await makeVariant(payload);
    const a = await orderOf([{ variant: variant.id, unitQty: 1 }], 'draft');
    const b = await payload.update({ collection: 'purchaseOrders', id: a.id, data: { status: 'ordered' }, overrideAccess: true, depth: 0 });
    const c = await orderOf([{ variant: variant.id, unitQty: 1 }]);
    const n = (x?: string | null) => Number(x?.slice(-5));
    expect(n(c.number)).toBe(n(b.number) + 1);
  });

  it('"received" cannot be set by hand, and goods-in lines are frozen', async () => {
    const { variant } = await makeVariant(payload);
    const po = await orderOf([{ variant: variant.id, unitQty: 2, costCents: 100 }]);
    await expect(payload.update({ collection: 'purchaseOrders', id: po.id, data: { status: 'received' }, user: stock, overrideAccess: false, depth: 0 })).rejects.toThrow();
    await receive(payload, po.id, [{ variant: variant.id, unitQty: 1 }], { user: stock.id, manager: false });
    const saved = await payload.findByID({ collection: 'purchaseOrders', id: po.id, overrideAccess: true, depth: 0 });
    await expect(
      payload.update({ collection: 'purchaseOrders', id: po.id, data: { lines: saved.lines?.map((l) => ({ ...l, unitQty: 9 })) }, user: stock, overrideAccess: false, depth: 0 }),
    ).rejects.toThrow();
    await expect(payload.update({ collection: 'purchaseOrders', id: po.id, data: { status: 'cancelled' }, user: stock, overrideAccess: false, depth: 0 })).rejects.toThrow();
  });

  it('an empty line cost takes the supplier’s price; the received quantity cannot be typed in', async () => {
    const { variant } = await makeVariant(payload);
    await payload.create({ collection: 'supplierProducts', data: { supplier: supplier.id, variant: variant.id, costCents: 777 }, overrideAccess: true });
    const po = await payload.create({ collection: 'purchaseOrders', data: { supplier: supplier.id, status: 'draft', lines: [{ variant: variant.id, unitQty: 4, receivedUnitQty: 4 }] }, user: stock, overrideAccess: false, depth: 0 });
    expect(po.lines?.[0]).toMatchObject({ costCents: 777, receivedUnitQty: 0 });
  });
});
