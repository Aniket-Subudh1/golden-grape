import { describe, expect, it } from 'vitest';
import { type CateringInput, requestCatering } from '@/modules/catering/service';
import { getTestPayload, makeStaff, parallel } from '@/tests/helpers';
import { acceptQuotation, createQuotationFromRequest, declineQuotation, expireQuotations, quotationsOf, sendQuotation } from './service';

// Catering quotations (Q-12): numbering, signing once, expiry, and who can read a quotation and its PDF.

const payload = await getTestPayload();

const pkg = await payload.create({
  collection: 'cateringPackages',
  data: { name: 'Convívio', pricePerGuestCents: 2800, minGuests: 10, includes: [{ item: 'Petiscos' }, { item: 'Vinho da casa' }] },
  overrideAccess: true,
  context: { skipRevalidate: true },
});

// Wednesday 11 Nov 2026, 11:00 in Luxembourg.
const NOW = new Date('2026-11-11T10:00:00Z');
const base: CateringInput = { package: pkg.id, guests: 20, date: '2026-12-12', time: '19:00', location: 'Bissen', name: 'Roby Test', email: 'roby@example.test', phone: '+352 621 123 456', locale: 'fr' };
const draftFor = async (over: Partial<CateringInput> = {}) => {
  const { request } = await requestCatering(payload, { ...base, ...over }, NOW);
  return { request, draft: await createQuotationFromRequest(payload, request.id, NOW) };
};
const signature = { name: 'Roby Test', ip: '203.0.113.7', userAgent: 'vitest' };
const read = (id: string) => payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true });

describe('catering quotations', () => {
  it('a draft from the request: customer, event, menu × guests at 3 %, priced by priceDocument', async () => {
    const { draft } = await draftFor();
    expect(draft).toMatchObject({
      status: 'draft',
      contact: { name: 'Roby Test', email: 'roby@example.test' },
      event: { guests: 20, location: 'Bissen', time: '19:00' },
      locale: 'fr',
      totals: { subtotalCents: 56000, totalCents: 56000, vatCents: 1631 },
    });
    expect(draft.number ?? null).toBeNull();
    expect(draft.lines?.map((l) => [l.description, l.detail, l.qty, l.unitPriceCents, l.vatBp])).toEqual([['Convívio', 'Petiscos, Vinho da casa', 20, 2800, 300]]);
  });

  it('sending numbers DEV-2026-0001 then 0002; a failed PDF uses no number; a sent quotation is read-only for staff', async () => {
    const a = (await draftFor()).draft;
    const { request, draft: b } = await draftFor();
    await expect(sendQuotation(payload, a.id, { now: NOW, render: () => Promise.reject(new Error('pdf failed')) })).rejects.toThrow('pdf failed');
    expect((await read(a.id)).status).toBe('draft');

    const sentA = await sendQuotation(payload, a.id, { now: NOW });
    const sentB = await sendQuotation(payload, b.id, { now: NOW });
    expect([sentA.quotation.number, sentB.quotation.number]).toEqual(['DEV-2026-0001', 'DEV-2026-0002']);
    expect(sentA.pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(sentB.request).toMatchObject({ id: request.id, to: 'quoted' });
    await expect(sendQuotation(payload, b.id, { now: NOW })).rejects.toMatchObject({ code: 'CONFLICT' });

    const staff = await makeStaff(payload, ['sales']);
    await expect(payload.update({ collection: 'quotations', id: b.id, data: { conditions: 'changed' }, overrideAccess: false, user: staff })).rejects.toThrow();
  });

  it('two accepts at once sign once; the signed PDF is kept for the customer; the request is accepted', async () => {
    const customer = await payload.create({ collection: 'customers', data: { name: 'Ana Silva', email: 'ana@example.test', password: 'Customer-Password-1', type: 'private', locale: 'pt' }, overrideAccess: true });
    const { request, draft } = await draftFor({ email: 'ana@example.test', name: 'Ana Silva' });
    await sendQuotation(payload, draft.id, { now: NOW });
    const results = await parallel(2, () => acceptQuotation(payload, draft.id, { ...signature, name: 'Ana Silva' }, { now: NOW }));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT', message: 'notAcceptable' });

    const signed = await read(draft.id);
    expect(signed).toMatchObject({ status: 'accepted', customer: customer.id, signature: { name: 'Ana Silva', ip: '203.0.113.7' } });
    const files = await payload.find({ collection: 'documentFiles', where: { quotation: { equals: draft.id } }, depth: 0, overrideAccess: true });
    expect(files.docs.map((f) => [f.kind, f.customer]).sort()).toEqual([
      ['quotation', customer.id],
      ['quotation_signed', customer.id],
    ]);
    expect((await payload.findByID({ collection: 'cateringRequests', id: request.id, depth: 0, overrideAccess: true })).status).toBe('accepted');
  });

  it('past its last valid day it cannot be signed, and the daily job marks it expired', async () => {
    const { draft } = await draftFor();
    await sendQuotation(payload, draft.id, { now: NOW });
    const lastDay = new Date((await read(draft.id)).validUntil);
    const dayAfter = new Date(lastDay.getTime() + 24 * 60 * 60 * 1000);
    await expect(acceptQuotation(payload, draft.id, signature, { now: dayAfter })).rejects.toMatchObject({ message: 'notAcceptable' });
    expect((await expireQuotations(payload, lastDay)).map((q) => q.id)).not.toContain(draft.id);
    expect((await expireQuotations(payload, dayAfter)).map((q) => q.id)).toContain(draft.id);
    expect((await read(draft.id)).status).toBe('expired');
  });

  it('declined: the reason is kept and the request is declined; a declined quotation cannot be signed', async () => {
    const { request, draft } = await draftFor();
    await sendQuotation(payload, draft.id, { now: NOW });
    await declineQuotation(payload, draft.id, { reason: 'Budget', now: NOW });
    expect(await read(draft.id)).toMatchObject({ status: 'declined', declineReason: 'Budget' });
    expect((await payload.findByID({ collection: 'cateringRequests', id: request.id, depth: 0, overrideAccess: true })).status).toBe('declined');
    await expect(acceptQuotation(payload, draft.id, signature, { now: NOW })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a customer reads only their own quotations and files, and never the PDF bytes through the API', async () => {
    const make = async (name: string) => {
      const c = await payload.create({ collection: 'customers', data: { name, email: `${name}@example.test`, password: 'Customer-Password-1', type: 'private', locale: 'fr' }, overrideAccess: true });
      const { draft } = await draftFor({ email: `${name}@example.test`, name });
      const sent = await sendQuotation(payload, draft.id, { now: NOW });
      return { customer: { ...c, collection: 'customers' as const }, quotation: sent.quotation };
    };
    const a = await make('carla');
    const b = await make('diogo');
    expect((await quotationsOf(payload, a.customer)).map((q) => q.id)).toEqual([a.quotation.id]);
    await expect(payload.findByID({ collection: 'quotations', id: b.quotation.id, overrideAccess: false, user: a.customer })).rejects.toThrow();
    const bFile = String(b.quotation.pdf);
    await expect(payload.findByID({ collection: 'documentFiles', id: bFile, overrideAccess: false, user: a.customer })).rejects.toThrow();
    const own = await payload.findByID({ collection: 'documentFiles', id: String(a.quotation.pdf), overrideAccess: false, user: a.customer });
    expect(own.filename).toBe(`${a.quotation.number}.pdf`);
    expect((own as { data?: string }).data).toBeUndefined();
  });
});
