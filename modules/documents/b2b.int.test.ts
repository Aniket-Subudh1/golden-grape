import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }), headers: async () => new Headers() }));
import { createCustomerByStaff } from '@/modules/customers/service';
import { onHand } from '@/modules/inventory/service';
import { getTestPayload, makeStaff, makeVariant } from '@/tests/helpers';
import { createB2bQuotation, orderFromQuotation } from './b2b';
import { issueInvoice } from './invoicing';

// M3.2 T5 (AC-01, AC-02): a quotation for a business customer uses their list prices; once accepted, the order and the
// invoice keep the quoted prices even after the price list changes; an expired quotation cannot become an order.

const payload = await getTestPayload();
const NOW = new Date('2026-11-17T10:00:00Z');

let wine: Awaited<ReturnType<typeof makeVariant>>;
let staff: Awaited<ReturnType<typeof makeStaff>>;
let rui: Awaited<ReturnType<typeof createCustomerByStaff>>;
let list: { id: string };

beforeAll(async () => {
  await payload.updateGlobal({
    slug: 'BusinessSettings',
    data: { business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' }, modules: { b2b: true, promotions: true } },
    overrideAccess: true,
    context: { skipRevalidate: true },
  });
  wine = await makeVariant(payload, { onHand: 100, price: 1400, packaging: [6] });
  staff = await makeStaff(payload, ['sales']);
  list = await payload.create({ collection: 'priceLists', data: { name: 'Lisboa', pricesInclVat: false, lines: [{ variant: wine.variant.id, unit: wine.units[6], priceCents: 5400 }] }, overrideAccess: true });
  rui = await createCustomerByStaff(payload, { name: 'Rui Costa', phone: '+352 621 500 001', email: 'rui-b2b-docs@example.test', type: 'business', company: 'Restaurante Lisboa', locale: 'pt' });
  await payload.update({ collection: 'customers', id: rui.id, data: { priceList: list.id, paymentTerm: '30', addresses: [{ line1: '12 rue de la Gare', postalCode: '7795', city: 'Bissen', isDefault: true }] }, overrideAccess: true });
});

describe('B2B quotation → order → invoice', () => {
  it('quoted at the list price, the order and the invoice keep it after the list changes (AC-M3.2-01, AC-M3.2-02)', async () => {
    const { quotation } = await createB2bQuotation(payload, { customer: rui.id, lines: [{ variant: wine.variant.id, unit: wine.units[6], qty: 2 }] }, { now: NOW });
    // 5400 net @17 % = 6318 a box.
    expect(quotation).toMatchObject({ kind: 'b2b', status: 'sent', number: 'DEV-2026-0001', totals: { totalCents: 12636 } });
    expect(quotation.lines?.[0]).toMatchObject({ qty: 2, unitPriceCents: 6318, totalCents: 12636 });
    await payload.update({ collection: 'priceLists', id: list.id, data: { lines: [{ variant: wine.variant.id, unit: wine.units[6], priceCents: 9000 }] }, overrideAccess: true });
    const before = (await onHand(payload, [wine.variant.id]))[wine.variant.id];
    const { order } = await orderFromQuotation(payload, quotation.id, { staff: staff.id, staffName: 'Sales', now: NOW });
    const doc = await payload.findByID({ collection: 'orders', id: order, overrideAccess: true, depth: 0 });
    expect(doc).toMatchObject({ channel: 'mobile', mode: 'b2b', status: 'confirmed', totals: { totalCents: 12636 }, payment: { method: 'invoice' } });
    expect(doc.lines?.[0]).toMatchObject({ unitPriceCents: 6318, unitQty: 2, baseQty: 12 });
    expect((await onHand(payload, [wine.variant.id]))[wine.variant.id]).toBe(before - 12);
    const again = await orderFromQuotation(payload, quotation.id, { staff: staff.id, staffName: 'Sales', now: NOW });
    expect(again.order).toBe(order);
    const q = await payload.findByID({ collection: 'quotations', id: quotation.id, overrideAccess: true, depth: 0 });
    expect(q).toMatchObject({ status: 'accepted', order });
    const invoice = await issueInvoice(payload, order, { now: NOW });
    expect(invoice).toMatchObject({ locale: 'pt', totals: { totalCents: 12636 }, billing: { company: 'Restaurante Lisboa', address: '12 rue de la Gare, L-7795 Bissen' } });
  });

  it('an expired quotation cannot become an order', async () => {
    const { quotation } = await createB2bQuotation(payload, { customer: rui.id, lines: [{ variant: wine.variant.id, qty: 1 }] }, { now: NOW });
    await expect(orderFromQuotation(payload, quotation.id, { staff: staff.id, staffName: 'Sales', now: new Date('2027-03-01T10:00:00Z') })).rejects.toMatchObject({ message: 'quotationClosed' });
  });
});
