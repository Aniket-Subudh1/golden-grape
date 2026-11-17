import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
  headers: async () => new Headers(),
}));
import { createCustomerByStaff } from '@/modules/customers/service';
import { placeStaffOrder, recordRefund } from '@/modules/sales/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { exportDocuments, issueCreditNote, issueDeliveryNote, issueInvoice, markInvoicePaid } from './invoicing';

// M3.2 T5 (AC-03, AC-04): invoice numbers are gapless and unique under concurrency and failures; issued documents
// never change; a refund of an invoiced order issues its credit note in its own series.

const payload = await getTestPayload();
const NOW = new Date('2026-11-17T10:00:00Z');

let wine: Awaited<ReturnType<typeof makeVariant>>;
let staff: Awaited<ReturnType<typeof makeStaff>>;
let rui: Awaited<ReturnType<typeof createCustomerByStaff>>;

beforeAll(async () => {
  await payload.updateGlobal({
    slug: 'BusinessSettings',
    data: {
      business: {
        name: 'Golden Grape',
        street: '25 Zac Klengbousbierg',
        postalCode: '7795',
        city: 'Bissen',
        vatNumber: 'LU00000000',
      },
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  });
  wine = await makeVariant(payload, { onHand: 1000, price: 1170 });
  staff = await makeStaff(payload, ['sales']);
  rui = await createCustomerByStaff(payload, {
    name: 'Rui Costa',
    phone: '+352 621 400 001',
    email: 'rui-docs@example.test',
    type: 'business',
    company: 'Restaurante Lisboa',
    vatNumber: 'LU12345678',
    locale: 'pt',
  });
  await payload.update({ collection: 'customers', id: rui.id, data: { paymentTerm: '30' }, overrideAccess: true });
});

const order = async (qty = 2, payment: 'invoice' | 'onsite' = 'invoice') =>
  (
    await placeStaffOrder(
      payload,
      { idempotencyKey: randomUUID(), customer: rui.id, lines: [{ variant: wine.variant.id, qty }], payment },
      { staff: staff.id, now: NOW },
    )
  ).id;
const seq = (n: string) => Number(n.split('-').at(-1));

describe('issueInvoice', () => {
  it('20 invoices issued at once → FAC-2026-00001 … 00020, no gap, no duplicate', async () => {
    const orders = await Promise.all(Array.from({ length: 20 }, () => order()));
    const results = await parallel(20, (i) => issueInvoice(payload, orders[i], { now: NOW }));
    const numbers = results.map((r) =>
      r.status === 'fulfilled' ? r.value.number : `failed: ${(r as PromiseRejectedResult).reason}`,
    );
    expect(numbers.every((n) => /^FAC-2026-\d{5}$/.test(n))).toBe(true);
    expect(numbers.map(seq).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('a PDF that fails to render writes nothing and uses no number: the next invoice takes it', async () => {
    const id = await order();
    await expect(
      issueInvoice(payload, id, {
        now: NOW,
        render: async () => {
          throw new Error('pdf down');
        },
      }),
    ).rejects.toThrow('pdf down');
    expect(
      (await payload.count({ collection: 'invoices', where: { order: { equals: id } }, overrideAccess: true }))
        .totalDocs,
    ).toBe(0);
    const invoice = await issueInvoice(payload, id, { now: NOW });
    expect(invoice.number).toBe('FAC-2026-00021');
  });

  it('the snapshot: lines as charged, the customer’s company and VAT number, due in 30 days, a stored PDF; twice → the same invoice', async () => {
    const id = await order(3);
    const invoice = await issueInvoice(payload, id, { now: NOW });
    expect(invoice).toMatchObject({
      status: 'issued',
      billing: { company: 'Restaurante Lisboa', vatNumber: 'LU12345678' },
      totals: { totalCents: 3510 },
      amountDueCents: 3510,
      locale: 'pt',
    });
    expect(invoice.lines?.[0]).toMatchObject({ qty: 3, unitPriceCents: 1170, totalCents: 3510, vatBp: 1700 });
    expect(invoice.dueAt?.slice(0, 10)).toBe('2026-12-17');
    const file = await payload.findByID({
      collection: 'documentFiles',
      id: invoice.pdf as string,
      overrideAccess: true,
      depth: 0,
    });
    expect(file).toMatchObject({ kind: 'invoice', filename: `${invoice.number}.pdf` });
    expect(file.sizeBytes).toBeGreaterThan(2000);
    expect((await issueInvoice(payload, id, { now: NOW })).id).toBe(invoice.id);
  });

  it('an issued invoice cannot be edited or deleted by anyone; only its payment moves', async () => {
    const invoice = await issueInvoice(payload, await order(), { now: NOW });
    await expect(
      payload.update({
        collection: 'invoices',
        id: invoice.id,
        data: { billing: { company: 'Other' } },
        overrideAccess: true,
      }),
    ).rejects.toThrow();
    await expect(
      payload.update({
        collection: 'invoices',
        id: invoice.id,
        data: { status: 'paid' },
        user: staff,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      payload.delete({ collection: 'invoices', id: invoice.id, user: staff, overrideAccess: false }),
    ).rejects.toThrow();
    const paid = await markInvoicePaid(payload, invoice.id, { user: staff.id });
    expect(paid.status).toBe('paid');
    const o = await payload.findByID({
      collection: 'orders',
      id: invoice.order as string,
      overrideAccess: true,
      depth: 0,
    });
    expect(o.payment).toMatchObject({ status: 'paid', paidCents: 2340 });
  });

  it('an order paid on site gets an invoice already marked paid', async () => {
    const invoice = await issueInvoice(payload, await order(1, 'onsite'), { now: NOW });
    expect(invoice).toMatchObject({ status: 'paid', paidBeforeCents: 1170, amountDueCents: 0 });
  });
});

describe('credit notes', () => {
  it('a refund of an invoiced order issues a credit note in its own series and credits the invoice (AC-M3.2-04)', async () => {
    const id = await order(2, 'onsite');
    const invoice = await issueInvoice(payload, id, { now: NOW });
    await recordRefund(payload, id, {
      amountCents: 2340,
      at: NOW,
      method: 'onsite',
      reason: 'bottles returned',
      user: staff.id,
    });
    const notes = (
      await payload.find({
        collection: 'creditNotes',
        where: { invoice: { equals: invoice.id } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs;
    expect(notes).toHaveLength(1);
    expect(notes[0].number).toBe('AV-2026-00001');
    expect(notes[0]).toMatchObject({ reason: 'bottles returned', totals: { totalCents: 2340 } });
    expect(
      (await payload.findByID({ collection: 'invoices', id: invoice.id, overrideAccess: true, depth: 0 })).status,
    ).toBe('credited');
  });

  it('part of an invoice by line and quantity, then the rest; never more than it holds', async () => {
    const invoice = await issueInvoice(payload, await order(4), { now: NOW });
    const part = await issueCreditNote(payload, invoice.id, {
      reason: 'one bottle broken',
      lines: [{ index: 0, qty: 1 }],
    });
    expect(part.totals?.totalCents).toBe(1170);
    expect(
      (await payload.findByID({ collection: 'invoices', id: invoice.id, overrideAccess: true, depth: 0 })).status,
    ).toBe('partly_credited');
    await expect(
      issueCreditNote(payload, invoice.id, { reason: 'too much', lines: [{ index: 0, qty: 4 }] }),
    ).rejects.toMatchObject({ message: 'creditTooHigh' });
    const rest = await issueCreditNote(payload, invoice.id, { reason: 'the rest' });
    expect(rest.totals?.totalCents).toBe(3510);
    expect(
      (await payload.findByID({ collection: 'invoices', id: invoice.id, overrideAccess: true, depth: 0 })).status,
    ).toBe('credited');
    await expect(issueCreditNote(payload, invoice.id, { reason: 'again' })).rejects.toMatchObject({
      message: 'alreadyCredited',
    });
  });
});

describe('delivery notes and the export', () => {
  it('a delivery note: its own number, the lines without prices, once per order', async () => {
    const id = await order(2);
    const note = await issueDeliveryNote(payload, id, { now: NOW });
    expect(note.number).toMatch(/^BL-2026-\d{5}$/);
    expect(note.lines?.[0]).toMatchObject({ qty: 2 });
    expect(note.lines?.[0].totalCents ?? null).toBeNull();
    expect((await issueDeliveryNote(payload, id, { now: NOW })).id).toBe(note.id);
  });

  it('the accountant’s CSV: one row per invoice and credit note, net and VAT per rate, credit notes negative', async () => {
    const { headers, rows } = await exportDocuments(payload, '2026-11-17', '2026-11-17');
    expect(headers).toEqual([
      'type',
      'number',
      'date',
      'customer',
      'vat_number',
      'net_17',
      'vat_17',
      'total',
      'status',
    ]);
    const credit = rows.find((r) => r[1] === 'AV-2026-00001')!;
    expect(credit).toEqual([
      'credit_note',
      'AV-2026-00001',
      '2026-11-17',
      'Restaurante Lisboa',
      'LU12345678',
      '-20.00',
      '-3.40',
      '-23.40',
      '',
    ]);
    expect(rows.filter((r) => r[0] === 'invoice').length).toBeGreaterThanOrEqual(25);
  });
});
