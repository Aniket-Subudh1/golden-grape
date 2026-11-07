import type { Payload, PayloadRequest, Where } from 'payload';
import { AppError } from '@/lib/errors';
import { model, type Tx, withTx } from '@/lib/tx';
import { stockRules } from '@/modules/catalogue/service';
import { toBaseQty } from '@/modules/catalogue/packaging';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { MovementChannel, MovementType } from './collections';

export type MovementLine = {
  variant: string;
  /** Packaging unit moved (box of 6…); omitted = the variant's base unit. */
  unit?: string;
  /** Signed number of `unit`s (or base units). */
  unitQty: number;
  type: MovementType;
  reason?: string;
  channel: MovementChannel;
  ref?: { relationTo: 'stockCounts' | 'orders'; value: string };
  /** The order line a return belongs to (GG-042), so a line is never returned twice. */
  lineId?: string;
  user?: string;
};

// Types that may never take stock below zero (02 §5.1 step 3; M2.1 T4: adjustments use the same guard).
const GUARDED: MovementType[] = ['sale', 'adjustment'];

const defaultLowStock = async () => (await getSettingsPrivate()).alerts?.defaultLowStock ?? 3;

/**
 * The only writer of stock (02 §5.1). In the caller's transaction it converts packaging to base units, merges by
 * variant, applies one atomic `$inc` per variant (guarded for sales and adjustments: OUT_OF_STOCK rolls everything
 * back), recomputes `lowStock` in the same update, and appends one movement row per line.
 * Lines whose variant does not track stock (counter dishes, gift cards) are dropped.
 */
export async function postMovements(tx: Tx, lines: MovementLine[]): Promise<void> {
  if (lines.length === 0) return;
  const rules = await stockRules({ payload: tx.req.payload, req: tx.req }, lines.map((l) => l.variant), lines.flatMap((l) => (l.unit ? [l.unit] : [])));
  const tracked = lines.filter((line) => {
    const variant = rules.variants.get(line.variant);
    if (!variant) throw new AppError('NOT_FOUND', 'variant', line.variant);
    return variant.trackStock;
  });
  if (tracked.length === 0) return;

  const deltas = new Map<string, { qty: number; guarded: boolean }>();
  const rows = tracked.map((line) => {
    let factor = 1;
    if (line.unit) {
      const unit = rules.units.get(line.unit);
      if (!unit || unit.variant !== line.variant) throw new AppError('VALIDATION', 'unit', line.unit);
      factor = unit.factor;
    }
    const qty = toBaseQty(line.unitQty, factor);
    const delta = deltas.get(line.variant) ?? { qty: 0, guarded: false };
    deltas.set(line.variant, { qty: delta.qty + qty, guarded: delta.guarded || GUARDED.includes(line.type) });
    return { ...line, qty };
  });

  const low = await defaultLowStock();
  const levels = tx.model('stockLevels');
  const now = new Date();
  for (const [variant, { qty, guarded }] of deltas) {
    if (qty === 0) continue;
    // Aggregation-pipeline update: the new onHand and its lowStock flag are written together, atomically.
    const update = [
      { $set: { onHand: { $add: [{ $ifNull: ['$onHand', 0] }, qty] }, updatedAt: now, createdAt: { $ifNull: ['$createdAt', now] } } },
      { $set: { lowStock: { $lte: ['$onHand', { $ifNull: ['$lowStockThreshold', low] }] } } },
    ];
    if (guarded && qty < 0) {
      const result = await levels.updateOne({ variant, onHand: { $gte: -qty } }, update, { session: tx.session });
      if (result.matchedCount === 0) throw new AppError('OUT_OF_STOCK', 'OUT_OF_STOCK', variant);
    } else {
      await levels.updateOne({ variant }, update, { session: tx.session, upsert: true });
    }
  }

  for (const row of rows) {
    await tx.req.payload.create({
      collection: 'stockMovements',
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: {
        variant: row.variant,
        qty: row.qty,
        unit: row.unit,
        unitQty: row.unitQty,
        type: row.type,
        reason: row.reason,
        channel: row.channel,
        ref: row.ref,
        lineId: row.lineId,
        user: row.user,
      },
    });
  }
}

/** Creates the variant's stock row at 0 if it has none (a new variant appears in stock lists straight away). */
export async function ensureStockLevel(req: PayloadRequest, variant: string) {
  const { totalDocs } = await req.payload.count({ collection: 'stockLevels', where: { variant: { equals: variant } }, req, overrideAccess: true });
  if (totalDocs > 0) return;
  await req.payload.create({ collection: 'stockLevels', req, overrideAccess: true, data: { variant, onHand: 0, lowStock: 0 <= (await defaultLowStock()) } });
}

/** Removes the stock row of a deleted variant (only possible when it has no movements). */
export async function dropStockLevel(req: PayloadRequest, variant: string) {
  await req.payload.delete({ collection: 'stockLevels', where: { variant: { equals: variant } }, req, overrideAccess: true });
}

export async function hasMovements(req: PayloadRequest, by: { variants?: string[]; unit?: string }) {
  if (by.variants?.length === 0) return false;
  const where: Where = by.unit ? { unit: { equals: by.unit } } : { variant: { in: by.variants ?? [] } };
  const { totalDocs } = await req.payload.count({ collection: 'stockMovements', where, req, overrideAccess: true });
  return totalDocs > 0;
}

/** Sets a variant's low-stock alert level (null = settings default) and recomputes its flag in the same update. */
export async function setLowStockThreshold(tx: Tx, variant: string, threshold: number | null) {
  const { totalDocs } = await tx.req.payload.count({ collection: 'variants', where: { id: { equals: variant } }, req: tx.req, overrideAccess: true });
  if (totalDocs === 0) throw new AppError('NOT_FOUND', 'variant', 'variant');
  const low = await defaultLowStock();
  const now = new Date();
  await tx.model('stockLevels').updateOne(
    { variant },
    [
      { $set: { lowStockThreshold: threshold, onHand: { $ifNull: ['$onHand', 0] }, updatedAt: now, createdAt: { $ifNull: ['$createdAt', now] } } },
      { $set: { lowStock: { $lte: ['$onHand', { $ifNull: ['$lowStockThreshold', low] }] } } },
    ],
    { session: tx.session, upsert: true },
  );
}

/** Raw on-hand quantities, for staff screens only (0 when a variant has no stock row). */
export async function onHand(payload: Payload, variantIds: string[]): Promise<Record<string, number>> {
  const { docs } = await payload.find({ collection: 'stockLevels', where: { variant: { in: variantIds } }, limit: 0, depth: 0, overrideAccess: true });
  const byVariant = new Map(docs.map((d) => [String(d.variant), d.onHand]));
  return Object.fromEntries(variantIds.map((id) => [id, byVariant.get(id) ?? 0]));
}

/** Staff overview of several variants together (the product list): units on hand and whether any is low. */
export async function stockSummary(payload: Payload, variantIds: string[]) {
  const { docs } = await payload.find({ collection: 'stockLevels', where: { variant: { in: variantIds } }, limit: 0, depth: 0, overrideAccess: true });
  return { onHand: docs.reduce((sum, d) => sum + d.onHand, 0), low: docs.some((d) => d.lowStock) };
}

/** The public projection: never the raw count. Variants that do not track stock are always available. */
export async function availability(payload: Payload, variantIds: string[]): Promise<Record<string, { inStock: boolean; maxQty: number | null }>> {
  const [{ variants }, stock] = await Promise.all([stockRules({ payload }, variantIds, []), onHand(payload, variantIds)]);
  return Object.fromEntries(
    variantIds.map((id) => {
      if (variants.get(id)?.trackStock === false) return [id, { inStock: true, maxQty: null }];
      const qty = Math.max(0, stock[id] ?? 0);
      return [id, { inStock: qty > 0, maxQty: qty }];
    }),
  );
}

/** Manual stock correction (M2.1 T4): a signed quantity with a reason, never below zero. */
export async function adjust(payload: Payload, input: { variant: string; qty: number; reason: string; user: string }) {
  await withTx(payload, (tx) =>
    postMovements(tx, [{ variant: input.variant, unitQty: input.qty, type: 'adjustment', reason: input.reason, channel: 'backoffice', user: input.user }]),
  );
}

/**
 * Posts a stock count: snapshots `expected` from the stock rows inside the transaction, writes one `count`
 * movement per line with counted − expected (zeros skipped) and marks the count posted. Posting twice is a no-op.
 */
export async function postCount(payload: Payload, countId: string, user: string): Promise<{ posted: boolean }> {
  return withTx(payload, async (tx) => {
    // Claim the count first: of two parallel posts, the second conflicts, retries and finds it already posted.
    const claim = await tx.model('stockCounts').updateOne({ _id: countId, status: 'open' }, { $set: { status: 'posted' } }, { session: tx.session });
    if (claim.matchedCount === 0) {
      const exists = await tx.model('stockCounts').exists({ _id: countId }).session(tx.session);
      if (!exists) throw new AppError('NOT_FOUND', 'count');
      return { posted: false };
    }
    const count = await tx.req.payload.findByID({ collection: 'stockCounts', id: countId, depth: 0, req: tx.req, overrideAccess: true });
    const lines = (count.lines ?? []).map((line) => ({ ...line, variant: String(typeof line.variant === 'object' ? line.variant.id : line.variant) }));
    const ids = lines.map((l) => l.variant);
    if (new Set(ids).size !== ids.length) throw new AppError('VALIDATION', 'duplicateVariant', 'lines');

    const { docs } = await tx.req.payload.find({ collection: 'stockLevels', where: { variant: { in: ids } }, limit: 0, depth: 0, req: tx.req, overrideAccess: true });
    const expected = new Map(docs.map((d) => [String(d.variant), d.onHand]));
    const snapshot = lines.map((line) => ({ ...line, expected: expected.get(line.variant) ?? 0 }));

    await postMovements(
      tx,
      snapshot
        .filter((line) => line.counted !== line.expected)
        .map((line) => ({
          variant: line.variant,
          unitQty: line.counted - line.expected,
          type: 'count' as const,
          channel: 'backoffice' as const,
          ref: { relationTo: 'stockCounts' as const, value: countId },
          user,
        })),
    );
    await tx.req.payload.update({
      collection: 'stockCounts',
      id: countId,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: { status: 'posted', postedAt: new Date().toISOString(), lines: snapshot.map(({ id, variant, counted, expected: e }) => ({ id, variant, counted, expected: e })) },
    });
    return { posted: true };
  });
}

/**
 * Recomputes every stock row from the ledger (02 §5.1): onHand = Σ movement qty. Returns the rows that differ; with
 * `fix`, rewrites them. Used by scripts/rebuild-stock.mts and the integration tests.
 */
export async function rebuildStock(payload: Payload, { fix = false } = {}) {
  const sums = await model(payload, 'stockMovements').aggregate<{ _id: unknown; qty: number }>([{ $group: { _id: '$variant', qty: { $sum: '$qty' } } }]);
  const ledger = new Map(sums.map((s) => [String(s._id), s.qty]));
  const levels = await model(payload, 'stockLevels').find({}, { variant: 1, onHand: 1 }).lean<{ variant: unknown; onHand: number }[]>();
  const cached = new Map(levels.map((l) => [String(l.variant), l.onHand]));
  const differences = [...new Set([...ledger.keys(), ...cached.keys()])]
    .map((variant) => ({ variant, cache: cached.get(variant) ?? null, ledger: ledger.get(variant) ?? 0 }))
    .filter((d) => d.cache !== d.ledger && !(d.cache === null && d.ledger === 0));
  if (fix && differences.length > 0) {
    const low = await defaultLowStock();
    const now = new Date();
    for (const d of differences) {
      await model(payload, 'stockLevels').updateOne(
        { variant: d.variant },
        [
          { $set: { onHand: d.ledger, updatedAt: now, createdAt: { $ifNull: ['$createdAt', now] } } },
          { $set: { lowStock: { $lte: ['$onHand', { $ifNull: ['$lowStockThreshold', low] }] } } },
        ],
        { upsert: true },
      );
    }
  }
  return differences;
}
