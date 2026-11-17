import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// The customer helpers import next/headers (the website session); outside a request there is none.
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
  headers: async () => new Headers(),
}));
import { createCustomerByStaff } from '@/modules/customers/service';
import { onHand, rebuildStock } from '@/modules/inventory/service';
import { type PlaceOrderInput, placeOrder, placeStaffOrder } from '@/modules/sales/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { quoteCart } from './service';

// M3.2 T4: what would silently cost money if wrong. A code's last use taken twice, a customer's limit, a B2B box
// price on the phone, and one promotion giving the same totals on every channel.

const payload = await getTestPayload();
const NOW = new Date('2026-11-17T09:00:00Z'); // 10:00 in Luxembourg
const DATE = '2026-11-17';
const everyDay = Array.from({ length: 7 }, (_, day) => ({
  day: String(day) as '0',
  open: '08:00' as const,
  close: '20:00' as const,
}));

const modules = (on: boolean) =>
  payload.updateGlobal({
    slug: 'BusinessSettings',
    data: {
      business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' },
      modules: { b2b: on, promotions: on },
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  });

let wine: Awaited<ReturnType<typeof makeVariant>>;
let staff: Awaited<ReturnType<typeof makeStaff>>;

beforeAll(async () => {
  await modules(true);
  await payload.create({
    collection: 'slotRules',
    data: { mode: 'pickup', intervalMin: 30, capacityPerSlot: 50, leadTimeMin: 0, maxDaysAhead: 14, days: everyDay },
    overrideAccess: true,
  });
  wine = await makeVariant(payload, { onHand: 200, price: 1400, packaging: [6] });
  staff = await makeStaff(payload, ['sales']);
});

const webOrder = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: randomUUID(),
  mode: 'pickup',
  lines: [{ variant: wine.variant.id, qty: 4 }],
  date: DATE,
  time: '15:00',
  name: 'Ana Silva',
  email: 'ana@example.test',
  phone: '+352 621 000 000',
  payment: 'onsite',
  locale: 'pt',
  ...over,
});

describe('discount codes in the order transaction', () => {
  it('a code with maxUses 1 used by 5 orders at once → exactly one order gets it, uses = 1', async () => {
    await payload.create({
      collection: 'discountCodes',
      data: { code: 'once', type: 'percent', percentBp: 1000, maxUses: 1, channels: ['webshop'] },
      overrideAccess: true,
    });
    const results = await parallel(5, () => placeOrder(payload, webOrder({ code: 'ONCE' }), { now: NOW }));
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    for (const r of results.filter((r) => r.status === 'rejected'))
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: expect.stringMatching(/CONFLICT|VALIDATION/) });
    const code = (
      await payload.find({ collection: 'discountCodes', where: { code: { equals: 'ONCE' } }, overrideAccess: true })
    ).docs[0];
    expect(code.uses).toBe(1);
    const placed = await payload.findByID({
      collection: 'orders',
      id: (ok[0] as PromiseFulfilledResult<{ id: string }>).value.id,
      overrideAccess: true,
      depth: 0,
    });
    expect(placed.pricing).toMatchObject({ code: 'ONCE' });
    expect(placed.totals).toMatchObject({ subtotalCents: 5600, discountCents: 560, totalCents: 5040 });
    expect(await rebuildStock(payload)).toEqual([]);
  });

  it('a code below its minimum is refused with the reason, and nothing is written', async () => {
    await payload.create({
      collection: 'discountCodes',
      data: { code: 'MIN50', type: 'percent', percentBp: 1000, minOrderCents: 5000, channels: ['webshop'] },
      overrideAccess: true,
    });
    const before = (await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs;
    await expect(
      placeOrder(payload, webOrder({ code: 'min50', lines: [{ variant: wine.variant.id, qty: 3 }] }), { now: NOW }),
    ).rejects.toMatchObject({ code: 'VALIDATION', message: 'CODE_MIN_NOT_MET' });
    expect((await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs).toBe(before);
  });

  it('min 50 € and one use per customer (AC-M3.2-06): refused below 50 €, accepted once, refused on the second order', async () => {
    const ana = await createCustomerByStaff(payload, {
      name: 'Ana',
      phone: '+352 621 100 001',
      email: 'ana-code@example.test',
      type: 'private',
      locale: 'pt',
    });
    await payload.create({
      collection: 'discountCodes',
      data: {
        code: 'WELCOME',
        type: 'fixed',
        amountCents: 500,
        minOrderCents: 5000,
        maxUsesPerCustomer: 1,
        channels: ['webshop', 'mobile'],
      },
      overrideAccess: true,
    });
    const sale = (qty: number) =>
      placeStaffOrder(
        payload,
        {
          idempotencyKey: randomUUID(),
          customer: ana.id,
          lines: [{ variant: wine.variant.id, qty }],
          payment: 'onsite',
          code: 'welcome',
        },
        { staff: staff.id, now: NOW },
      );
    await expect(sale(3)).rejects.toMatchObject({ message: 'CODE_MIN_NOT_MET' });
    const first = await sale(4);
    const order = await payload.findByID({ collection: 'orders', id: first.id, overrideAccess: true, depth: 0 });
    expect(order.totals).toMatchObject({ discountCents: 500, totalCents: 5100 });
    await expect(sale(4)).rejects.toMatchObject({ message: 'CODE_ALREADY_USED' });
  });
});

describe('prices for a customer', () => {
  it('B2B list price per box of 6 on the phone (AC-M3.2-09): 2 boxes at the list price, 12 bottles out', async () => {
    const list = await payload.create({
      collection: 'priceLists',
      data: {
        name: 'Lisboa',
        pricesInclVat: false,
        lines: [{ variant: wine.variant.id, unit: wine.units[6], priceCents: 6000 }],
      },
      overrideAccess: true,
    });
    const rui = await createCustomerByStaff(payload, {
      name: 'Rui',
      phone: '+352 621 100 002',
      email: 'rui-b2b@example.test',
      type: 'business',
      company: 'Restaurante Lisboa',
      locale: 'fr',
    });
    await payload.update({ collection: 'customers', id: rui.id, data: { priceList: list.id }, overrideAccess: true });
    const before = (await onHand(payload, [wine.variant.id]))[wine.variant.id];
    const placed = await placeStaffOrder(
      payload,
      {
        idempotencyKey: randomUUID(),
        customer: rui.id,
        lines: [{ variant: wine.variant.id, unit: wine.units[6], qty: 2 }],
        payment: 'invoice',
      },
      { staff: staff.id, now: NOW },
    );
    const order = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    // 6000 net @17 % = 7020 gross per box.
    expect(order.lines?.[0]).toMatchObject({ unitPriceCents: 7020, unitQty: 2, baseQty: 12, totalCents: 14040 });
    expect((await onHand(payload, [wine.variant.id]))[wine.variant.id]).toBe(before - 12);
  });

  it('a group list applies to a member without a list of their own; the bottle without a list price keeps the public price', async () => {
    const list = await payload.create({
      collection: 'priceLists',
      data: { name: 'Restaurants', pricesInclVat: true, lines: [{ variant: wine.variant.id, priceCents: 1200 }] },
      overrideAccess: true,
    });
    const group = await payload.create({
      collection: 'customerGroups',
      data: { name: 'Restaurants', priceList: list.id },
      overrideAccess: true,
    });
    const member = await createCustomerByStaff(payload, {
      name: 'Bruno',
      phone: '+352 621 100 003',
      type: 'business',
      company: 'Tasca',
      locale: 'fr',
    });
    await payload.update({ collection: 'customers', id: member.id, data: { group: group.id }, overrideAccess: true });
    const q = await quoteCart(
      payload,
      [
        { variant: wine.variant.id, qty: 1 },
        { variant: wine.variant.id, unit: wine.units[6], qty: 1 },
      ],
      { customer: member, channel: 'mobile', locale: 'fr' },
    );
    expect(q.lines.map((l) => [l.unitPriceCents, l.fromList])).toEqual([
      [1200, true],
      [8400, false],
    ]);
  });

  it('one 10 % promotion gives the same totals on the website and on the phone for the same private customer (AC-M3.2-05)', async () => {
    const promo = await payload.create({
      collection: 'promotions',
      data: { name: 'Dez', type: 'percent', percentBp: 1000, target: 'all', channels: ['webshop', 'mobile'] },
      overrideAccess: true,
    });
    const ze = await createCustomerByStaff(payload, {
      name: 'Zé',
      phone: '+352 621 100 004',
      type: 'private',
      locale: 'pt',
    });
    const lines = [{ variant: wine.variant.id, qty: 3 }];
    const web = await quoteCart(payload, lines, { customer: ze, channel: 'webshop', locale: 'pt' });
    const phone = await quoteCart(payload, lines, { customer: ze, channel: 'mobile', locale: 'pt' });
    expect(web.totalCents).toBe(3780);
    expect(phone).toMatchObject({ totalCents: web.totalCents, vatCents: web.vatCents, promotionCents: 420 });
    await payload.update({ collection: 'promotions', id: promo.id, data: { active: false }, overrideAccess: true });
  });

  it('with the modules off, list prices and promotions are ignored', async () => {
    await modules(false);
    const rui = (
      await payload.find({
        collection: 'customers',
        where: { email: { equals: 'rui-b2b@example.test' } },
        overrideAccess: true,
      })
    ).docs[0];
    const q = await quoteCart(payload, [{ variant: wine.variant.id, unit: wine.units[6], qty: 1 }], {
      customer: rui,
      channel: 'mobile',
      locale: 'fr',
      code: 'WELCOME',
    });
    expect(q.lines[0]).toMatchObject({ unitPriceCents: 8400, fromList: false });
    expect(q.codeRejected).toBe('CODE_UNKNOWN');
    await modules(true);
  });
});
