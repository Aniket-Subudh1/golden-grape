'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { audit } from '@/lib/audit';
import { readTable, toCsv } from '@/lib/table';
import { withTx } from '@/lib/tx';
import { ADJUST_REASONS } from './labels';
import { adjust, countFromTable, exportMovements, postCount, setLowStockThreshold } from './service';

const roles = { roles: ['manager' as const, 'stock' as const] };

// A listed reason is stored as its key (shown translated); "other" stores the staff member's own words.
export const adjustStock = action(
  z
    .object({
      variant: z.string().min(1),
      qty: z.coerce.number().int().refine((n) => n !== 0, 'zero'),
      reason: z.enum(ADJUST_REASONS),
      note: z.string().trim().optional(),
    })
    .refine((input) => input.reason !== 'other' || (input.note?.length ?? 0) >= 3, { path: ['note'], message: 'min3' }),
  roles,
  async (input, { payload, user }) => {
    const reason = input.reason === 'other' ? (input.note as string) : input.reason;
    await adjust(payload, { variant: input.variant, qty: input.qty, reason, user: user.id });
    const variant = await payload.findByID({ collection: 'variants', id: input.variant, depth: 0, overrideAccess: true, disableErrors: true, select: { title: true } });
    await audit(payload, { user: user.id, action: 'stock.adjust', collection: 'variants', id: input.variant, ref: variant?.title, reason, after: { qty: input.qty } });
  },
);

export const setLowStockAlert = action(
  z.object({ variant: z.string().min(1), threshold: z.union([z.literal(''), z.coerce.number().int().min(0)]) }),
  roles,
  (input, { payload }) => withTx(payload, (tx) => setLowStockThreshold(tx, input.variant, input.threshold === '' ? null : input.threshold)),
);

export const postStockCount = action(z.object({ count: z.string().min(1) }), roles, async (input, { payload, user }) => {
  const result = await postCount(payload, input.count, user.id);
  if (result.posted) {
    const count = await payload.findByID({ collection: 'stockCounts', id: input.count, depth: 0, overrideAccess: true, disableErrors: true });
    await audit(payload, { user: user.id, action: 'stock.count', collection: 'stockCounts', id: input.count, ref: count?.note || null, after: { lines: count?.lines?.length ?? 0 } });
  }
  return result;
});

/** A stock count from a file (back-office Import / Export page): creates an open count to check and post as usual. */
export const importStockCount = action(
  z.object({ file: z.instanceof(File).refine((f) => f.size > 0 && f.size <= 10 * 1024 * 1024, 'size') }),
  roles,
  async ({ file }, { payload, user }) => {
    const table = await readTable(Buffer.from(await file.arrayBuffer()), file.name);
    const result = await countFromTable(payload, table, { user: user.id, note: file.name.replace(/\.[^.]+$/, '') });
    if (result.count) await audit(payload, { user: user.id, action: 'doc.create', collection: 'stockCounts', id: result.count, ref: file.name, after: { lines: result.lines } });
    return result;
  },
);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const exportStockMovements = action(
  z.object({ from: day, to: day, lang: z.enum(['fr', 'en', 'de', 'pt']) }).refine((i) => i.from <= i.to, { path: ['to'], message: 'order' }),
  roles,
  async (input, { payload }) => {
    const { headers, rows } = await exportMovements(payload, input);
    return { name: `golden-grape-stock-movements-${input.from}-${input.to}.csv`, csv: toCsv(headers, rows), rows: rows.length };
  },
);
