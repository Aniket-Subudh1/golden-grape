import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }), headers: async () => new Headers() }));
import * as mail from '@/lib/mail';
import { createCustomerByStaff } from '@/modules/customers/service';
import { onHand } from '@/modules/inventory/service';
import { salesSummary } from '@/modules/reporting/service';
import { placeStaffOrder } from '@/modules/sales/service';
import { getTestPayload, makeStaff, makeVariant } from '@/tests/helpers';
import type { PosConnector } from './connector';
import { assignCode, confirmImport, MAX_ATTEMPTS, previewImport, processOutbox } from './service';

// M3.3 T5 (AC-M3.3-07, AC-M3.3-08): the till's sales file posts `pos` orders and stock once; the outbox drains with no
// till, backs off then gives up with an alert when the till fails, and stays empty with the POS module off.

const payload = await getTestPayload();
const sent = vi.spyOn(mail, 'sendMail').mockResolvedValue(undefined);
const settings = (pos: boolean) =>
  payload.updateGlobal({
    slug: 'BusinessSettings',
    data: { business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' }, modules: { pos }, alerts: { outboxAlertEmail: 'till@example.test' } },
    overrideAccess: true,
    context: { skipRevalidate: true },
  });

let wine: Awaited<ReturnType<typeof makeVariant>>;
let manager: Awaited<ReturnType<typeof makeStaff>>;

beforeAll(async () => {
  await settings(true);
  wine = await makeVariant(payload, { onHand: 5, price: 1350, packaging: [6] });
  await payload.update({ collection: 'variants', id: wine.variant.id, data: { barcode: '5601234000016', sku: 'GG-DOURO' }, overrideAccess: true });
  await payload.update({ collection: 'packagingUnits', id: wine.units[6], data: { barcode: '15601234000013' }, overrideAccess: true });
  manager = await makeStaff(payload, ['manager']);
});

const FILE = [
  'Ticket;Date;Heure;Code barre;Référence;Désignation;Quantité;Prix unitaire TTC',
  '501;16/11/2026;18:20;5601234000016;;Douro;2;13,50', // two bottles
  '501;16/11/2026;18:20;15601234000013;;Douro carton;1;75,00', // one box of 6 by its own barcode
  '502;16/11/2026;19:05;9990000000001;;Unknown;1;4,00', // not in the catalogue
  '503;16/11/2026;19:30;;GG-DOURO;Douro;1;13,50', // by SKU
  '504;31/02/2026;19:40;5601234000016;;Douro;1;13,50', // unreadable date
].join('\r\n');

describe('till sales file', () => {
  it('preview → import: one pos order per receipt, stock out (box factor applied, never blocked), the same file refused', async () => {
    const before = (await onHand(payload, [wine.variant.id]))[wine.variant.id];
    const data = Buffer.from(FILE, 'utf8');
    const preview = await previewImport(payload, { data, filename: 'ventes-16-11.csv', user: manager.id });
    expect(preview).toMatchObject({ receipts: 3, lines: 4, errors: [{ line: 6, reason: 'date' }], unmatched: [{ code: '9990000000001', lines: [4], qty: 1 }] });
    expect(preview.ready.map((r) => [r.receipt, r.lines.map((l) => [l.qty, l.factor])])).toEqual([
      ['501', [[2, 1], [1, 6]]],
      ['503', [[1, 1]]],
    ]);
    // Uploading it again before importing reopens the same preview.
    expect((await previewImport(payload, { data, filename: 'again.csv', user: manager.id })).id).toBe(preview.id);

    const result = await confirmImport(payload, { id: preview.id, user: manager.id });
    expect(result).toMatchObject({ lines: 3, left: 1 });
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]).toMatch(/^POS-2026-\d{5}$/);
    // 2 + 6 + 1 = 9 bottles from 5 on hand: imported anyway, the stock goes negative (flagged low).
    expect((await onHand(payload, [wine.variant.id]))[wine.variant.id]).toBe(before - 9);
    const { docs: orders } = await payload.find({ collection: 'orders', where: { channel: { equals: 'pos' } }, sort: 'number', overrideAccess: true, depth: 0 });
    expect(orders[0]).toMatchObject({ status: 'completed', mode: 'instore', slot: { date: '2026-11-16', from: '18:20' }, totals: { totalCents: 2 * 1350 + 7500 }, payment: { status: 'paid', paidCents: 10200 } });
    const moves = await payload.find({ collection: 'stockMovements', where: { type: { equals: 'pos_import' } }, overrideAccess: true, depth: 0 });
    expect(moves.docs.map((m) => m.qty).sort((a, b) => a - b)).toEqual([-6, -2, -1]);
    expect(moves.docs.every((m) => m.channel === 'pos')).toBe(true);
    // The sales figures count them on the receipt's day, channel pos.
    expect(await salesSummary(payload, { from: '2026-11-16', to: '2026-11-16', channel: 'pos' })).toMatchObject({ orders: 2, grossCents: 10200 + 1350 });

    await expect(previewImport(payload, { data, filename: 'ventes-16-11.csv', user: manager.id })).rejects.toMatchObject({ message: 'alreadyImported' });

    // The unknown code fixed (it was this wine), then imported in the same import.
    await expect(assignCode(payload, { id: preview.id, code: '9990000000001', target: 'nope' })).rejects.toMatchObject({ message: 'unknownCode' });
    const fixed = await assignCode(payload, { id: preview.id, code: '9990000000001', target: 'GG-DOURO' });
    expect(fixed.unmatched).toEqual([]);
    expect(fixed.ready.map((r) => r.receipt)).toEqual(['502']);
    expect(await confirmImport(payload, { id: preview.id, user: manager.id })).toMatchObject({ lines: 1, left: 0 });
    const done = await payload.findByID({ collection: 'posImports', id: preview.id, overrideAccess: true, depth: 0 });
    expect(done).toMatchObject({ status: 'posted', receipts: 3, matched: 4, unmatched: 0 });
    await expect(confirmImport(payload, { id: preview.id, user: manager.id })).rejects.toMatchObject({ message: 'alreadyImported' });
  });
});

describe('outbox', () => {
  let stocked: Awaited<ReturnType<typeof makeVariant>>;
  beforeAll(async () => {
    stocked = await makeVariant(payload, { onHand: 50, price: 1000 });
  });
  const sale = async () => {
    const customer = await createCustomerByStaff(payload, { name: 'Ana', phone: '+352 621 700 001', email: `ana-${randomUUID()}@example.test`, type: 'private', locale: 'fr' });
    return placeStaffOrder(payload, { idempotencyKey: randomUUID(), customer: customer.id, lines: [{ variant: stocked.variant.id, qty: 1 }], payment: 'invoice' }, { staff: manager.id });
  };
  const rowsOf = async (ref: string) => (await payload.find({ collection: 'outbox', where: { ref: { equals: ref } }, overrideAccess: true, depth: 0 })).docs;

  it('no till connected: the order is queued in its transaction, then marked sent (no-pos)', async () => {
    const placed = await sale();
    expect((await rowsOf(placed.number)).map((r) => [r.topic, r.status])).toEqual([['order.created', 'pending']]);
    expect(await processOutbox(payload)).toMatchObject({ sent: 1 });
    expect((await rowsOf(placed.number))[0]).toMatchObject({ status: 'sent', note: 'no-pos', attempts: 1 });
    expect(await processOutbox(payload)).toMatchObject({ sent: 0, failed: 0, dead: 0 });
  });

  it('a failing till: backoff, then given up after 5 attempts with one alert e-mail', async () => {
    const placed = await sale();
    const broken: PosConnector = { name: 'test', pushOrder: async () => { throw new Error('till offline'); }, pullSales: async () => [], health: async () => ({ ok: false, detail: '' }) };
    let now = new Date();
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await processOutbox(payload, { now, adapter: broken });
      const [row] = await rowsOf(placed.number);
      expect(row.attempts).toBe(i);
      if (i < MAX_ATTEMPTS) {
        expect(row).toMatchObject({ status: 'failed', lastError: 'till offline' });
        // Not due again before its backoff.
        expect(await processOutbox(payload, { now, adapter: broken })).toMatchObject({ failed: 0 });
        now = new Date(row.nextAttemptAt!);
      } else expect(row.status).toBe('dead');
    }
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][0]).toMatchObject({ to: 'till@example.test' });
    const logs = await payload.find({ collection: 'integrationLogs', where: { ok: { equals: false } }, overrideAccess: true });
    expect(logs.totalDocs).toBe(MAX_ATTEMPTS);
  });

  it('POS module off: an order queues nothing', async () => {
    await settings(false);
    const placed = await sale();
    expect(await rowsOf(placed.number)).toEqual([]);
    await settings(true);
  });
});
