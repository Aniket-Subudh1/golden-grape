import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
  headers: async () => new Headers(),
}));
import { createCustomerByStaff } from '@/modules/customers/service';
import { placeStaffOrder, recordRefund, transition } from '@/modules/sales/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { CODE_ALPHABET } from './codes';
import { mailGiftCards } from './mail';
import { expirePoints } from './rewards';

// M3.2 T3: gift cards and loyalty points are money for the customer. Balances only move with a ledger row, never
// twice, never below 0, and come back when an order is cancelled or refunded.

const payload = await getTestPayload();
const NOW = new Date('2026-11-17T09:00:00Z');

let wine: Awaited<ReturnType<typeof makeVariant>>;
let staff: Awaited<ReturnType<typeof makeStaff>>;
let ana: Awaited<ReturnType<typeof createCustomerByStaff>>;

beforeAll(async () => {
  await payload.updateGlobal({
    slug: 'BusinessSettings',
    data: {
      business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' },
      modules: { loyalty: true, giftCards: true },
      loyalty: { pointsPerEuro: 1, pointValueCents: 5, expiryMonths: 24, eligibleChannels: ['webshop', 'mobile'] },
      giftCards: { validityMonths: 24 },
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  });
  wine = await makeVariant(payload, { onHand: 500, price: 1000 });
  staff = await makeStaff(payload, ['sales']);
  ana = await createCustomerByStaff(payload, {
    name: 'Ana',
    phone: '+352 621 200 001',
    email: 'ana-rewards@example.test',
    type: 'private',
    locale: 'pt',
  });
});

const sale = (qty: number, over: Partial<Parameters<typeof placeStaffOrder>[1]> = {}) =>
  placeStaffOrder(
    payload,
    {
      idempotencyKey: randomUUID(),
      customer: ana.id,
      lines: [{ variant: wine.variant.id, qty }],
      payment: 'onsite',
      ...over,
    },
    { staff: staff.id, now: NOW },
  );
const card = async (cents: number) =>
  payload.create({ collection: 'giftCards', data: { initialCents: cents }, overrideAccess: true });
const balanceOf = async (id: string) =>
  (await payload.findByID({ collection: 'giftCards', id, overrideAccess: true, depth: 0 })).balanceCents;
const pointsOf = async () =>
  (await payload.findByID({ collection: 'customers', id: ana.id, overrideAccess: true, depth: 0 })).loyaltyBalance ?? 0;
const ledgerOf = async (cardId: string) =>
  (
    await payload.find({
      collection: 'giftCardLedger',
      where: { card: { equals: cardId } },
      sort: 'createdAt',
      overrideAccess: true,
      depth: 0,
    })
  ).docs.map((r) => [r.type, r.amountCents]);

describe('gift cards', () => {
  it('issued in the admin: a 16-character code from the alphabet, balance = amount, an "issue" row', async () => {
    const c = await card(5000);
    expect(c.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{16}$`));
    expect(c.balanceCents).toBe(5000);
    expect(await ledgerOf(c.id)).toEqual([['issue', 5000]]);
  });

  it('50 € used for 30 € then 20 € → balance 0; a third use is refused (AC-M3.2-07)', async () => {
    const c = await card(5000);
    const first = await sale(3, { giftCards: [c.code!] });
    const o1 = await payload.findByID({ collection: 'orders', id: first.id, overrideAccess: true, depth: 0 });
    expect(o1.pricing).toMatchObject({
      giftCards: [expect.objectContaining({ code: c.code, amountCents: 3000 })],
      amountDueCents: 0,
    });
    expect(o1.status).toBe('completed');
    expect(await balanceOf(c.id)).toBe(2000);
    await sale(2, { giftCards: [c.code!] });
    expect(await balanceOf(c.id)).toBe(0);
    await expect(sale(1, { giftCards: [c.code!] })).rejects.toMatchObject({ message: 'GIFT_CARD_EMPTY' });
    expect(await ledgerOf(c.id)).toEqual([
      ['issue', 5000],
      ['redeem', -3000],
      ['redeem', -2000],
    ]);
  });

  it('three sales of 30 € spending one 50 € card at once: never more than 50 € taken, the balance never below 0, each order owes the rest', async () => {
    const c = await card(5000);
    const results = await parallel(3, () => sale(3, { giftCards: [c.code!], payment: 'invoice' }));
    const placed = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.id] : []));
    const orders = await Promise.all(
      placed.map((id) => payload.findByID({ collection: 'orders', id, overrideAccess: true, depth: 0 })),
    );
    const used = orders.reduce(
      (sum, o) => sum + (o.pricing?.giftCards ?? []).reduce((s, g) => s + (g.amountCents ?? 0), 0),
      0,
    );
    expect(used).toBeLessThanOrEqual(5000);
    expect(await balanceOf(c.id)).toBe(5000 - used);
    for (const o of orders)
      expect((o.pricing?.amountDueCents ?? 0) + (o.pricing?.giftCards?.[0]?.amountCents ?? 0)).toBe(3000);
    const ledger = await ledgerOf(c.id);
    expect(ledger.filter(([type]) => type === 'redeem').reduce((s, [, a]) => s - (a as number), 0)).toBe(used);
  });

  it('a cancelled order gives the card amount back, once', async () => {
    const c = await card(4000);
    const placed = await sale(2, { giftCards: [c.code!], payment: 'invoice' });
    expect(await balanceOf(c.id)).toBe(2000);
    await transition(payload, placed.id, 'cancelled', { user: staff.id, reason: 'test' });
    expect(await balanceOf(c.id)).toBe(4000);
    expect((await ledgerOf(c.id)).at(-1)).toEqual(['refund', 2000]);
  });

  it('a gift card sold online is issued when the order is confirmed, one per unit, and its e-mail goes once', async () => {
    const giftProduct = await payload.create({
      collection: 'products',
      data: {
        name: 'Carte cadeau',
        kind: 'wine',
        giftCard: true,
        category: (await payload.find({ collection: 'categories', limit: 1, overrideAccess: true })).docs[0].id,
        vatClass: 'standard',
        firstVariant: { priceCents: 2500 },
      } as never,
      overrideAccess: true,
    });
    const variant = (
      await payload.find({
        collection: 'variants',
        where: { product: { equals: giftProduct.id } },
        overrideAccess: true,
      })
    ).docs[0];
    expect(variant.trackStock).toBe(false);
    const placed = await placeStaffOrder(
      payload,
      { idempotencyKey: randomUUID(), customer: ana.id, lines: [{ variant: variant.id, qty: 2 }], payment: 'invoice' },
      { staff: staff.id, now: NOW },
    );
    const cards = (
      await payload.find({ collection: 'giftCards', where: { order: { equals: placed.id } }, overrideAccess: true })
    ).docs;
    expect(cards.map((x) => [x.initialCents, x.balanceCents, x.recipientEmail])).toEqual([
      [2500, 2500, 'ana-rewards@example.test'],
      [2500, 2500, 'ana-rewards@example.test'],
    ]);
    expect(await mailGiftCards(payload, placed.id)).toBe(2);
    expect(await mailGiftCards(payload, placed.id)).toBe(0);
  });
});

describe('loyalty points', () => {
  it('a completed 100 € order adds 100 points; refunding it takes them back (AC-M3.2-08)', async () => {
    const before = await pointsOf();
    const placed = await sale(10);
    expect(await pointsOf()).toBe(before + 100);
    await recordRefund(payload, placed.id, {
      amountCents: 10000,
      at: NOW,
      method: 'onsite',
      reason: 'returned',
      user: staff.id,
    });
    const order = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    expect(order.status).toBe('refunded');
    expect(await pointsOf()).toBe(before);
  });

  it('points pay part of a sale (whole points only) and come back when it is cancelled', async () => {
    await sale(20); // +200 points
    const before = await pointsOf();
    const placed = await sale(1, { useLoyalty: true, payment: 'invoice' });
    const order = await payload.findByID({ collection: 'orders', id: placed.id, overrideAccess: true, depth: 0 });
    // 10 € = 200 points at 5 cents.
    expect(order.pricing).toMatchObject({ loyaltyPoints: 200, loyaltyCents: 1000, amountDueCents: 0 });
    expect(await pointsOf()).toBe(before - 200);
    await transition(payload, placed.id, 'cancelled', { user: staff.id, reason: 'test' });
    expect(await pointsOf()).toBe(before);
  });

  it('a staff correction needs a reason and cannot take the balance below 0', async () => {
    const points = await pointsOf();
    const user = staff;
    await expect(
      payload.create({
        collection: 'loyaltyLedger',
        data: { customer: ana.id, points: -(points + 1), reason: 'too many' },
        user,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      payload.create({
        collection: 'loyaltyLedger',
        data: { customer: ana.id, points: 10 },
        user,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await payload.create({
      collection: 'loyaltyLedger',
      data: { customer: ana.id, points: 10, reason: 'goodwill' },
      user,
      overrideAccess: false,
    });
    expect(await pointsOf()).toBe(points + 10);
  });

  it('the expiry job removes only the points of old lots still unspent, once', async () => {
    const bruno = await createCustomerByStaff(payload, {
      name: 'Bruno',
      phone: '+352 621 200 002',
      type: 'private',
      locale: 'fr',
    });
    // An old lot of 100 (expired), 40 of it spent; a recent lot of 50.
    await payload.update({ collection: 'customers', id: bruno.id, data: {}, overrideAccess: true });
    const { model } = await import('@/lib/tx');
    await model(payload, 'customers').updateOne({ _id: bruno.id }, { $set: { loyaltyBalance: 110 } });
    const rows = [
      { points: 100, type: 'earn', expiresAt: new Date('2026-01-01'), createdAt: new Date('2024-01-01') },
      { points: -40, type: 'redeem', createdAt: new Date('2025-01-01') },
      { points: 50, type: 'earn', expiresAt: new Date('2028-01-01'), createdAt: new Date('2026-01-01') },
    ];
    for (const r of rows)
      await model(payload, 'loyaltyLedger').create({ customer: bruno.id, ...r, updatedAt: r.createdAt });
    expect(await expirePoints(payload, NOW)).toBe(60);
    expect(
      (await payload.findByID({ collection: 'customers', id: bruno.id, overrideAccess: true, depth: 0 }))
        .loyaltyBalance,
    ).toBe(50);
    expect(await expirePoints(payload, NOW)).toBe(0);
  });
});
