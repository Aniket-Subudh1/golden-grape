import type { Payload, Where } from 'payload';
import { AppError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n';
import { fromLocal } from '@/lib/time';
import { withTx } from '@/lib/tx';
import { staffItems, stockRules } from '@/modules/catalogue/service';
import { type MovementLine, postMovements } from '@/modules/inventory/service';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { PurchaseOrder } from '@/payload-types';
import type { PoStatus } from './collections';
import { cheapest, costPerBottle, suggestUnits } from './reorder';

// Purchasing (M3.1 T4, 04 §5). Goods enter stock only here, through postMovements, in one transaction with the
// purchase order's received quantities, its status and the sizes' latest cost.

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { id: string }).id : ((v as string | null | undefined) ?? null));

/** Purchase orders goods can still arrive for. */
export const OPEN: PoStatus[] = ['ordered', 'partly_received'];

export type ReceiptLine = { variant: string; unit?: string | null; unitQty: number; reason?: string };

/**
 * Receives goods against a purchase order (M3.1 T4), all or nothing: `receipt` movements in base units (the box's
 * factor applied by postMovements), `receivedUnitQty` raised, status `partly_received` or `received`, and each size's
 * `costCents` set to its line cost ÷ factor. Receiving more than remains needs a reason. A size not on the order is
 * added to it, by a manager only.
 */
export async function receive(payload: Payload, poId: string, input: ReceiptLine[], { user, manager }: { user: string; manager: boolean }) {
  const wanted = mergeLines(input.filter((l) => l.unitQty > 0));
  if (wanted.length === 0) throw new AppError('VALIDATION', 'nothingReceived', 'lines');
  return withTx(payload, async (tx) => {
    const po = await tx.req.payload.findByID({ collection: 'purchaseOrders', id: poId, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
    if (!po) throw new AppError('NOT_FOUND', 'purchaseOrder');
    if (!OPEN.includes(po.status as PoStatus)) throw new AppError('CONFLICT', 'poNotOpen', 'status');
    const lines = (po.lines ?? []).map((l) => ({ id: l.id ?? undefined, variant: idOf(l.variant) as string, unit: idOf(l.unit), unitQty: l.unitQty, costCents: l.costCents ?? null, received: l.receivedUnitQty ?? 0 }));
    const rules = await stockRules({ payload: tx.req.payload, req: tx.req }, wanted.map((w) => w.variant), wanted.flatMap((w) => (w.unit ? [w.unit] : [])));

    const movements: MovementLine[] = [];
    for (const w of wanted) {
      if (!rules.variants.has(w.variant)) throw new AppError('NOT_FOUND', 'variant', w.variant);
      if (w.unit && rules.units.get(w.unit)?.variant !== w.variant) throw new AppError('VALIDATION', 'unit', w.unit);
      let line = lines.find((l) => l.variant === w.variant && (l.unit ?? null) === (w.unit ?? null));
      if (!line) {
        if (!manager) throw new AppError('FORBIDDEN', 'notOnOrder', w.variant);
        line = { id: undefined, variant: w.variant, unit: w.unit ?? null, unitQty: w.unitQty, costCents: await offerCost(tx.req.payload, idOf(po.supplier) as string, w, tx.req), received: 0 };
        lines.push(line);
      } else if (w.unitQty > line.unitQty - line.received && !w.reason?.trim()) {
        throw new AppError('VALIDATION', 'overReceipt', w.variant);
      }
      line.received += w.unitQty;
      movements.push({ variant: w.variant, unit: w.unit ?? undefined, unitQty: w.unitQty, type: 'receipt', reason: w.reason?.trim() || undefined, channel: 'mobile', ref: { relationTo: 'purchaseOrders', value: po.id }, user });
    }
    await postMovements(tx, movements);

    // The latest purchase cost of a bottle, from what was just received (law 2: money in integer cents).
    for (const w of wanted) {
      const line = lines.find((l) => l.variant === w.variant && (l.unit ?? null) === (w.unit ?? null));
      if (line?.costCents == null) continue;
      const factor = w.unit ? (rules.units.get(w.unit)?.factor ?? 1) : 1;
      await tx.model('variants').updateOne({ _id: w.variant }, { $set: { costCents: costPerBottle(line.costCents, factor) } }, { session: tx.session });
    }

    const status: PoStatus = lines.every((l) => l.received >= l.unitQty) ? 'received' : 'partly_received';
    // Rewriting the order makes two receipts at once conflict: the later one retries against the new quantities.
    const updated = await tx.req.payload.update({
      collection: 'purchaseOrders',
      id: po.id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      context: { byReceive: true },
      data: { status, lines: lines.map((l) => ({ id: l.id, variant: l.variant, unit: l.unit, unitQty: l.unitQty, costCents: l.costCents, receivedUnitQty: l.received })) },
    });
    return { order: updated, movements: movements.length };
  });
}

/** One entry per size and unit (two scans of the same box add up). */
function mergeLines(lines: ReceiptLine[]) {
  const merged = new Map<string, ReceiptLine>();
  for (const l of lines) {
    const key = `${l.variant}:${l.unit ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, unitQty: prev.unitQty + l.unitQty, reason: prev.reason || l.reason } : { ...l, unit: l.unit ?? null });
  }
  return [...merged.values()];
}

/** The supplier's price for a size and unit, for a line added on receipt; null when unknown. */
async function offerCost(payload: Payload, supplier: string, line: ReceiptLine, req: Parameters<typeof stockRules>[0]['req']) {
  const { docs } = await payload.find({ collection: 'supplierProducts', where: { supplier: { equals: supplier }, variant: { equals: line.variant }, unit: line.unit ? { equals: line.unit } : { exists: false } }, limit: 1, pagination: false, depth: 0, req, overrideAccess: true });
  return docs[0]?.costCents ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Reading

/** Orders still expecting goods, the soonest first (no date last): the phone's receive screen. */
export async function openPurchaseOrders(payload: Payload) {
  const { docs } = await payload.find({ collection: 'purchaseOrders', where: { status: { in: OPEN } }, sort: 'expectedAt', limit: 50, depth: 1, overrideAccess: true });
  return docs
    .map((po) => ({
      id: po.id,
      number: po.number ?? '',
      supplier: typeof po.supplier === 'object' ? po.supplier.name : '',
      status: po.status as PoStatus,
      expectedAt: po.expectedAt ?? null,
      lines: po.lines?.length ?? 0,
      remaining: (po.lines ?? []).reduce((sum, l) => sum + Math.max(0, l.unitQty - (l.receivedUnitQty ?? 0)), 0),
      ordered: (po.lines ?? []).reduce((sum, l) => sum + l.unitQty, 0),
    }))
    .sort((a, b) => (a.expectedAt ?? '9999').localeCompare(b.expectedAt ?? '9999'));
}

/** How many open orders are due by the end of `day` (Luxembourg): the staff home tile. Late ones count too. */
export async function dueBy(payload: Payload, day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const { totalDocs } = await payload.count({ collection: 'purchaseOrders', where: { status: { in: OPEN }, expectedAt: { less_than: fromLocal(y, m, d + 1).toISOString() } }, overrideAccess: true });
  return totalDocs;
}

/** One order with its lines in the staff member's language, for receiving: names, boxes, barcodes, what remains. */
export async function orderToReceive(payload: Payload, id: string, locale: Locale) {
  const po = await payload.findByID({ collection: 'purchaseOrders', id, depth: 1, overrideAccess: true, disableErrors: true });
  if (!po) return null;
  const items = new Map((await staffItems(payload, (po.lines ?? []).map((l) => idOf(l.variant) as string), locale)).map((i) => [i.variant, i]));
  return {
    id: po.id,
    number: po.number ?? '',
    status: po.status as PoStatus,
    supplier: typeof po.supplier === 'object' ? po.supplier.name : '',
    lines: (po.lines ?? []).map((l) => {
      const item = items.get(idOf(l.variant) as string);
      const unit = item?.units.find((u) => u.id === idOf(l.unit));
      return {
        variant: idOf(l.variant) as string,
        unit: idOf(l.unit),
        name: [item?.name, item?.label].filter(Boolean).join(' · '),
        unitLabel: unit?.label ?? null,
        factor: unit?.factor ?? 1,
        ordered: l.unitQty,
        received: l.receivedUnitQty ?? 0,
      };
    }),
  };
}

export type OrderToReceive = NonNullable<Awaited<ReturnType<typeof orderToReceive>>>;

/**
 * Low stock with what to buy (M3.1 T4): each tracked size at or below its level, its cheapest supplier offer (per
 * bottle) and the suggested quantity in that supplier's unit. A suggestion only: nothing is ordered automatically (Q§13).
 */
export async function reorderList(payload: Payload, locale: Locale) {
  const [{ docs: levels }, settings] = await Promise.all([
    payload.find({ collection: 'stockLevels', where: { lowStock: { equals: true } }, limit: 0, depth: 0, overrideAccess: true }),
    getSettingsPrivate(),
  ]);
  const fallback = settings.alerts?.defaultLowStock ?? 3;
  const ids = levels.map((l) => idOf(l.variant) as string);
  const [items, { docs: offers }] = await Promise.all([
    staffItems(payload, ids, locale),
    payload.find({ collection: 'supplierProducts', where: { variant: { in: ids } }, limit: 0, depth: 1, overrideAccess: true }),
  ]);
  const itemOf = new Map(items.map((i) => [i.variant, i]));
  return levels
    .map((level) => {
      const variant = idOf(level.variant) as string;
      const item = itemOf.get(variant);
      if (!item?.trackStock || !item.active) return null;
      const threshold = level.lowStockThreshold ?? fallback;
      const best = cheapest(
        offers
          .filter((o) => idOf(o.variant) === variant)
          .map((o) => {
            const unit = typeof o.unit === 'object' && o.unit ? o.unit : null;
            return { id: o.id, costCents: o.costCents, factor: unit?.factor ?? 1, unit: unit ? { id: unit.id, label: unit.label ?? '' } : null, supplier: typeof o.supplier === 'object' ? { id: o.supplier.id, name: o.supplier.name } : null, supplierRef: o.supplierRef ?? null };
          }),
      );
      return {
        variant,
        name: [item.name, item.label].filter(Boolean).join(' · '),
        sku: item.sku,
        onHand: level.onHand,
        threshold,
        offer: best,
        suggested: suggestUnits(threshold, level.onHand, best?.factor ?? 1),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.offer?.supplier?.name ?? '~').localeCompare(b.offer?.supplier?.name ?? '~') || a.name.localeCompare(b.name));
}

export type ReorderRow = Awaited<ReturnType<typeof reorderList>>[number];

/** Reorder rows grouped by supplier, the ones without a known supplier last (admin view and phone screen). */
export function bySupplier(rows: ReorderRow[]) {
  const groups = new Map<string, { id: string | null; name: string | null; rows: ReorderRow[] }>();
  for (const row of rows) {
    const key = row.offer?.supplier?.id ?? '';
    const group = groups.get(key) ?? { id: row.offer?.supplier?.id ?? null, name: row.offer?.supplier?.name ?? null, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1));
}

/** A draft purchase order for one supplier from chosen reorder rows (quantities in the supplier's unit). */
export async function draftFromReorder(payload: Payload, supplier: string, lines: { variant: string; unit?: string | null; unitQty: number }[]): Promise<PurchaseOrder> {
  if (lines.length === 0) throw new AppError('VALIDATION', 'nothingSelected', 'lines');
  return payload.create({
    collection: 'purchaseOrders',
    overrideAccess: true,
    depth: 0,
    data: { supplier, status: 'draft', lines: lines.map((l) => ({ variant: l.variant, unit: l.unit ?? undefined, unitQty: l.unitQty })) },
  });
}

export type SupplierRef = { sku?: string | null; barcode?: string | null; supplier: string; supplierRef?: string | null; costCents?: number | null };

/**
 * Supplier columns of the catalogue spreadsheet (M2.1 T6) into purchasing: a supplier per name (created when new) and
 * one bottle price per size (updated when it exists). Rows whose size is unknown or that have no cost are reported.
 */
export async function importSupplierRefs(payload: Payload, rows: SupplierRef[]) {
  const opts = { overrideAccess: true, depth: 0 } as const;
  const result = { suppliers: 0, created: 0, updated: 0, skipped: [] as { code: string; reason: 'unknown' | 'noCost' }[] };
  const supplierIds = new Map<string, string>();
  for (const row of rows) {
    const code = row.sku || row.barcode || '';
    const where: Where = row.sku ? { sku: { equals: row.sku } } : { barcode: { equals: row.barcode } };
    const variant = code ? (await payload.find({ collection: 'variants', where, limit: 1, ...opts })).docs[0] : undefined;
    if (!variant) {
      result.skipped.push({ code, reason: 'unknown' });
      continue;
    }
    if (row.costCents == null) {
      result.skipped.push({ code, reason: 'noCost' });
      continue;
    }
    const name = row.supplier.trim();
    let supplier = supplierIds.get(name.toLowerCase());
    if (!supplier) {
      const found = (await payload.find({ collection: 'suppliers', where: { name: { equals: name } }, limit: 1, ...opts })).docs[0];
      supplier = found?.id ?? (await payload.create({ collection: 'suppliers', data: { name }, ...opts })).id;
      if (!found) result.suppliers++;
      supplierIds.set(name.toLowerCase(), supplier);
    }
    const existing = (await payload.find({ collection: 'supplierProducts', where: { supplier: { equals: supplier }, variant: { equals: variant.id }, unit: { exists: false } }, limit: 1, ...opts })).docs[0];
    const data = { supplier, variant: variant.id, costCents: row.costCents, supplierRef: row.supplierRef ?? undefined };
    if (existing) {
      await payload.update({ collection: 'supplierProducts', id: existing.id, data, ...opts });
      result.updated++;
    } else {
      await payload.create({ collection: 'supplierProducts', data, ...opts });
      result.created++;
    }
  }
  return result;
}
