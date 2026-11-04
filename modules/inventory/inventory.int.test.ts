import { describe, expect, it } from 'vitest';
import { model, withTx } from '@/lib/tx';
import { importCatalogue, parseCatalogueCsv, TEMPLATE_COLUMNS } from '@/modules/catalogue/import';
import { findByBarcode } from '@/modules/catalogue/service';
import { getTestPayload, makeStaff, makeVariant, parallel } from '@/tests/helpers';
import { adjust, availability, onHand, postCount, postMovements, rebuildStock, setLowStockThreshold } from './service';

const payload = await getTestPayload();
const staff = await makeStaff(payload, ['stock']);

const movementsOf = async (variant: string) =>
  (await payload.find({ collection: 'stockMovements', where: { variant: { equals: variant } }, sort: 'createdAt', limit: 0, depth: 0, overrideAccess: true })).docs;
const level = async (variant: string) =>
  (await payload.find({ collection: 'stockLevels', where: { variant: { equals: variant } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
const sell = (variant: string, unitQty = 1, unit?: string) =>
  withTx(payload, (tx) => postMovements(tx, [{ variant, unit, unitQty: -unitQty, type: 'sale', channel: 'webshop' }]));

describe('catalogue', () => {
  it('AC-M2.1-01: a wine created in 4 languages gets its translations, a default variant and a stock row at 0', async () => {
    const category = await payload.create({ collection: 'categories', data: { name: 'Vins', slug: 'vins', kind: 'shop' }, overrideAccess: true });
    const product = await payload.create({
      collection: 'products',
      locale: 'fr',
      overrideAccess: true,
      user: staff,
      data: { name: 'Douro Reserva 2019', kind: 'wine', category: category.id, vatClass: 'intermediate', firstVariant: { priceCents: 3200, barcode: '5601234567890' } } as never,
    });
    for (const [locale, name] of [['en', 'Douro Reserve 2019'], ['de', 'Douro Reserva 2019 (DE)'], ['pt', 'Douro Reserva 2019 (PT)']] as const) {
      await payload.update({ collection: 'products', id: product.id, locale, data: { name }, overrideAccess: true });
    }
    const all = await payload.findByID({ collection: 'products', id: product.id, locale: 'all', overrideAccess: true });
    expect(all.name).toEqual({ fr: 'Douro Reserva 2019', en: 'Douro Reserve 2019', de: 'Douro Reserva 2019 (DE)', pt: 'Douro Reserva 2019 (PT)' });
    expect(all.vatClass).toBe('intermediate');

    const { docs: variants } = await payload.find({ collection: 'variants', where: { product: { equals: product.id } }, overrideAccess: true });
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ label: 'Douro Reserva 2019', priceCents: 3200, barcode: '5601234567890', sku: 'DOURO-RESERVA-2019', trackStock: true });
    expect(await level(variants[0].id)).toMatchObject({ onHand: 0 });

    // Saving the product again does not add a second default variant.
    await payload.update({ collection: 'products', id: product.id, data: { status: 'active' }, overrideAccess: true });
    expect((await payload.count({ collection: 'variants', where: { product: { equals: product.id } }, overrideAccess: true })).totalDocs).toBe(1);

    // Localized fields are stored per locale: the text index paths in products' custom.indexes.
    const raw = await payload.db.connection.collection('products').findOne({ slug: product.slug });
    expect(raw?.name).toMatchObject({ fr: 'Douro Reserva 2019', en: 'Douro Reserve 2019' });
  });

  it('a product cannot be created without the price of its first size', async () => {
    const { product } = await makeVariant(payload);
    await expect(
      payload.create({ collection: 'products', data: { name: 'No price', kind: 'wine', category: product.category, vatClass: 'standard' } as never, overrideAccess: true }),
    ).rejects.toThrow();
  });

  it('a snack gets an untracked default variant and no stock row', async () => {
    const { variant } = await makeVariant(payload, { kind: 'snack' });
    expect(variant.trackStock).toBe(false);
    expect(await level(variant.id)).toBeUndefined();
  });

  it('a barcode resolves to one thing: a variant barcode cannot be reused on a packaging unit, nor the reverse', async () => {
    const a = await makeVariant(payload);
    const b = await makeVariant(payload, { packaging: [6] });
    await payload.update({ collection: 'variants', id: a.variant.id, data: { barcode: '4000000000017' }, overrideAccess: true });
    await expect(
      payload.create({ collection: 'packagingUnits', data: { variant: b.variant.id, factor: 12, label: 'Box', barcode: '4000000000017' }, overrideAccess: true }),
    ).rejects.toThrow();
    await payload.update({ collection: 'packagingUnits', id: b.units[6], data: { barcode: '4000000000024' }, overrideAccess: true });
    await expect(payload.update({ collection: 'variants', id: a.variant.id, data: { barcode: '4000000000024' }, overrideAccess: true })).rejects.toThrow();
    await expect(payload.update({ collection: 'variants', id: b.variant.id, data: { barcode: '12ab' }, overrideAccess: true })).rejects.toThrow();

    expect(await findByBarcode(payload, '4000000000024')).toMatchObject({ variant: { id: b.variant.id }, factor: 6 });
    expect(await findByBarcode(payload, '4000000000017')).toMatchObject({ variant: { id: a.variant.id }, factor: 1, unit: undefined });
    expect(await findByBarcode(payload, '999999')).toBeNull();
  });

  it('a packaging factor below 2 is rejected', async () => {
    const { variant } = await makeVariant(payload);
    await expect(payload.create({ collection: 'packagingUnits', data: { variant: variant.id, factor: 1, label: 'Single' }, overrideAccess: true })).rejects.toThrow();
  });
});

describe('postMovements', () => {
  it('AC-M2.1-04: 20 parallel single sales against 5 in stock → exactly 5 succeed, 15 OUT_OF_STOCK, stock 0', async () => {
    const { variant } = await makeVariant(payload, { onHand: 5 });
    const results = await parallel(20, () => sell(variant.id));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(15);
    for (const r of rejected) expect(r.reason).toMatchObject({ code: 'OUT_OF_STOCK' });
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(0);
    expect((await movementsOf(variant.id)).filter((m) => m.type === 'sale')).toHaveLength(5);
  });

  it('AC-M2.1-02: a sale of 1 × box6 → −6, a receipt of 1 × box12 → +12, each movement keeps unit and base quantity', async () => {
    const { variant, units } = await makeVariant(payload, { onHand: 10, packaging: [6, 12] });
    await sell(variant.id, 1, units[6]);
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(4);
    await withTx(payload, (tx) => postMovements(tx, [{ variant: variant.id, unit: units[12], unitQty: 1, type: 'receipt', channel: 'backoffice' }]));
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(16);
    const [, sale, receipt] = await movementsOf(variant.id);
    expect(sale).toMatchObject({ type: 'sale', qty: -6, unit: units[6], unitQty: -1 });
    expect(receipt).toMatchObject({ type: 'receipt', qty: 12, unit: units[12], unitQty: 1 });
    // A box larger than the stock is refused as a whole.
    await expect(sell(variant.id, 2, units[12])).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(16);
  });

  it('merges lines of one variant and rolls the whole call back when one variant is short', async () => {
    const a = await makeVariant(payload, { onHand: 10, packaging: [6] });
    const b = await makeVariant(payload, { onHand: 1 });
    await expect(
      withTx(payload, (tx) =>
        postMovements(tx, [
          { variant: a.variant.id, unit: a.units[6], unitQty: -1, type: 'sale', channel: 'webshop' },
          { variant: a.variant.id, unitQty: -2, type: 'sale', channel: 'webshop' },
          { variant: b.variant.id, unitQty: -2, type: 'sale', channel: 'webshop' },
        ]),
      ),
    ).rejects.toMatchObject({ code: 'OUT_OF_STOCK', field: b.variant.id });
    expect(await onHand(payload, [a.variant.id, b.variant.id])).toEqual({ [a.variant.id]: 10, [b.variant.id]: 1 });
    expect(await movementsOf(a.variant.id)).toHaveLength(1);
  });

  it('a unit of another variant is refused', async () => {
    const a = await makeVariant(payload, { onHand: 10 });
    const b = await makeVariant(payload, { packaging: [6] });
    await expect(sell(a.variant.id, 1, b.units[6])).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('a sale of a variant that does not track stock writes no movement and never throws OUT_OF_STOCK', async () => {
    const { variant } = await makeVariant(payload, { kind: 'snack' });
    await expect(sell(variant.id, 50)).resolves.toBeUndefined();
    expect(await movementsOf(variant.id)).toHaveLength(0);
    expect(await availability(payload, [variant.id])).toEqual({ [variant.id]: { inStock: true, maxQty: null } });
  });

  it('AC-M2.1-05: with a threshold of 3, falling to 3 puts the variant in the low-stock list', async () => {
    const { variant } = await makeVariant(payload, { onHand: 10 });
    await withTx(payload, (tx) => setLowStockThreshold(tx, variant.id, 3));
    expect(await level(variant.id)).toMatchObject({ lowStock: false, lowStockThreshold: 3 });
    await sell(variant.id, 7);
    const low = await payload.find({ collection: 'stockLevels', where: { lowStock: { equals: true } }, limit: 0, depth: 0, overrideAccess: true });
    expect(low.docs.map((d) => d.variant)).toContain(variant.id);
    expect(await availability(payload, [variant.id])).toEqual({ [variant.id]: { inStock: true, maxQty: 3 } });
  });
});

describe('adjustments and counts', () => {
  it('an adjustment records user and reason; one below zero is refused', async () => {
    const { variant } = await makeVariant(payload, { onHand: 4 });
    await adjust(payload, { variant: variant.id, qty: -2, reason: 'breakage', user: staff.id });
    const last = (await movementsOf(variant.id)).at(-1);
    expect(last).toMatchObject({ type: 'adjustment', qty: -2, reason: 'breakage', user: staff.id, channel: 'backoffice' });
    await expect(adjust(payload, { variant: variant.id, qty: -3, reason: 'theft', user: staff.id })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(2);
  });

  it('AC-M2.1-06: a count expected 10, counted 7 → one movement −3; posting again adds nothing; the count is locked', async () => {
    const a = await makeVariant(payload, { onHand: 10 });
    const b = await makeVariant(payload, { onHand: 4 });
    const count = await payload.create({
      collection: 'stockCounts',
      data: { note: 'Cave', status: 'open', lines: [{ variant: a.variant.id, counted: 7 }, { variant: b.variant.id, counted: 4 }] },
      overrideAccess: false,
      user: staff,
    });
    expect(count).toMatchObject({ status: 'open', user: { id: staff.id } });

    const results = await parallel(3, () => postCount(payload, count.id, staff.id));
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(results.filter((r) => r.status === 'fulfilled' && r.value.posted)).toHaveLength(1);
    expect(await postCount(payload, count.id, staff.id)).toEqual({ posted: false });

    const counted = (await movementsOf(a.variant.id)).filter((m) => m.type === 'count');
    expect(counted).toEqual([expect.objectContaining({ qty: -3, user: staff.id, ref: { relationTo: 'stockCounts', value: count.id } })]);
    expect((await movementsOf(b.variant.id)).filter((m) => m.type === 'count')).toHaveLength(0);
    expect(await onHand(payload, [a.variant.id])).toEqual({ [a.variant.id]: 7 });

    const posted = await payload.findByID({ collection: 'stockCounts', id: count.id, depth: 0, overrideAccess: true });
    expect(posted.status).toBe('posted');
    expect(posted.lines?.map((l) => [l.counted, l.expected])).toEqual([[7, 10], [4, 4]]);
    await expect(payload.update({ collection: 'stockCounts', id: count.id, data: { note: 'changed' }, overrideAccess: false, user: staff })).rejects.toThrow();
    await expect(payload.delete({ collection: 'stockCounts', id: count.id, overrideAccess: false, user: staff })).rejects.toThrow();
  });

  it('AC-M2.1-03: no API role can create, edit or delete a movement or a stock level', async () => {
    const admin = await makeStaff(payload, ['admin']);
    const { variant } = await makeVariant(payload, { onHand: 1 });
    const [movement] = await movementsOf(variant.id);
    await expect(payload.update({ collection: 'stockMovements', id: movement.id, data: { qty: 100 }, overrideAccess: false, user: admin })).rejects.toThrow();
    await expect(payload.delete({ collection: 'stockMovements', id: movement.id, overrideAccess: false, user: admin })).rejects.toThrow();
    await expect(
      payload.create({ collection: 'stockMovements', data: { variant: variant.id, qty: 5, type: 'receipt', channel: 'backoffice' }, overrideAccess: false, user: admin }),
    ).rejects.toThrow();
    const row = await level(variant.id);
    await expect(payload.update({ collection: 'stockLevels', id: row.id, data: { onHand: 99 }, overrideAccess: false, user: admin })).rejects.toThrow();
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(1);
  });

  it('a variant with stock history cannot be deleted', async () => {
    const { variant, product } = await makeVariant(payload, { onHand: 1 });
    await expect(payload.delete({ collection: 'variants', id: variant.id, overrideAccess: true })).rejects.toThrow();
    await expect(payload.delete({ collection: 'products', id: product.id, overrideAccess: true })).rejects.toThrow();
    const fresh = await makeVariant(payload, { packaging: [6] });
    await payload.delete({ collection: 'products', id: fresh.product.id, overrideAccess: true });
    expect((await payload.count({ collection: 'variants', where: { product: { equals: fresh.product.id } }, overrideAccess: true })).totalDocs).toBe(0);
    expect(await level(fresh.variant.id)).toBeUndefined();
  });
});

describe('catalogue import', () => {
  const header = TEMPLATE_COLUMNS.join(',');
  const line = (values: Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>>) => TEMPLATE_COLUMNS.map((c) => values[c] ?? '').join(',');
  const good = { sku: 'IMP-1', name_fr: 'Vinho Verde', name_en: 'Green wine', kind: 'wine', category_slug: 'import-wines', vat_class: 'intermediate', price_eur: '14.00', box6_barcode: '5600000000061', opening_stock: '12', low_stock: '4' };

  it('AC-M2.1-07: one invalid row → nothing written, and the row number and reason are reported', async () => {
    await payload.create({ collection: 'categories', data: { name: 'Vins import', slug: 'import-wines', kind: 'shop' }, overrideAccess: true });
    const before = await payload.count({ collection: 'products', overrideAccess: true });
    const csv = [header, line(good), line({ ...good, sku: 'IMP-2', price_eur: 'abc' }), line({ ...good, sku: 'IMP-3', box6_barcode: '5600000000061', category_slug: 'nope' })].join('\n');
    const parsed = parseCatalogueCsv(csv);
    expect(parsed.errors).toEqual([{ row: 3, column: 'price_eur', message: '"abc" is not an amount in euros' }]);
    const result = await importCatalogue(payload, parsed.rows);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        // IMP-3 is spreadsheet row 4 even though row 3 was dropped for its format error.
        { row: 4, column: 'category_slug', message: 'no category "nope"' },
        { row: 4, column: 'box6_barcode', message: 'barcode 5600000000061 already used in row 2' },
      ]),
    );
    expect(await payload.count({ collection: 'products', overrideAccess: true })).toEqual(before);
  });

  it('imports, posts opening stock once and upserts by sku on a second run', async () => {
    const csv = [header, line(good)].join('\n');
    expect(await importCatalogue(payload, parseCatalogueCsv(csv).rows)).toMatchObject({ errors: [], created: 1, updated: 0 });
    const [variant] = (await payload.find({ collection: 'variants', where: { sku: { equals: 'IMP-1' } }, overrideAccess: true })).docs;
    expect(variant.priceCents).toBe(1400);
    expect(variant.title).toBe('Vinho Verde'); // the English label does not leak into the French title
    const labels = await payload.findByID({ collection: 'variants', id: variant.id, locale: 'all', overrideAccess: true });
    expect(labels.label).toMatchObject({ fr: 'Vinho Verde', en: 'Green wine' });
    expect(await level(variant.id)).toMatchObject({ onHand: 12, lowStockThreshold: 4, lowStock: false });
    const box = await findByBarcode(payload, '5600000000061');
    expect(box).toMatchObject({ variant: { id: variant.id }, factor: 6 });
    const en = await payload.findByID({ collection: 'products', id: typeof variant.product === 'object' ? variant.product.id : variant.product, locale: 'en', overrideAccess: true });
    expect(en.name).toBe('Green wine');

    const again = [header, line({ ...good, price_eur: '15', opening_stock: '99' })].join('\n');
    expect(await importCatalogue(payload, parseCatalogueCsv(again).rows)).toMatchObject({ errors: [], created: 0, updated: 1 });
    expect((await payload.findByID({ collection: 'variants', id: variant.id, overrideAccess: true })).priceCents).toBe(1500);
    expect((await movementsOf(variant.id)).map((m) => [m.type, m.qty, m.reason])).toEqual([['adjustment', 12, 'opening stock']]);
  });
});

describe('rebuild-stock', () => {
  it('reports 0 differences after everything above, and finds a tampered cache', async () => {
    expect(await rebuildStock(payload)).toEqual([]);
    const { variant } = await makeVariant(payload, { onHand: 3 });
    await model(payload, 'stockLevels').updateOne({ variant: variant.id }, { $set: { onHand: 30 } });
    expect(await rebuildStock(payload)).toEqual([{ variant: variant.id, cache: 30, ledger: 3 }]);
    await rebuildStock(payload, { fix: true });
    expect(await rebuildStock(payload)).toEqual([]);
    expect((await onHand(payload, [variant.id]))[variant.id]).toBe(3);
  });
});
