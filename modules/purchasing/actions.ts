'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { hasRole } from '@/lib/access';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { isModuleOn } from '@/modules/settings/service';
import { draftFromReorder, receive } from './service';

// Purchasing actions (M3.1 T4). The module switch is checked here too: a switched-off module does nothing.

const id = z.string().min(1).max(40);

async function moduleOn() {
  if (!(await isModuleOn('purchasing'))) throw new AppError('FORBIDDEN', 'moduleOff');
}

/** Goods received against a purchase order, from the phone (stock staff; a size not on the order: managers only). */
export const receivePurchase = action(
  z.object({
    order: id,
    lines: z.array(z.object({ variant: id, unit: id.nullable().optional(), unitQty: z.number().int().min(1).max(100_000), reason: z.string().trim().max(200).optional() })).min(1).max(300),
  }),
  { roles: ['stock', 'manager'] },
  async ({ order, lines }, { payload, user }) => {
    await moduleOn();
    const result = await receive(payload, order, lines, { user: user.id, manager: hasRole(user, ['manager']) });
    await audit(payload, { user: user.id, action: 'purchase.receive', collection: 'purchaseOrders', id: order, ref: result.order.number, after: { status: result.order.status, lines: lines.length } });
    return { status: result.order.status, number: result.order.number ?? '' };
  },
);

/** A draft purchase order for one supplier from the reorder list (managers). */
export const createDraftPurchase = action(
  z.object({ supplier: id, lines: z.array(z.object({ variant: id, unit: id.nullable().optional(), unitQty: z.number().int().min(1).max(100_000) })).min(1).max(300) }),
  { roles: ['manager'] },
  async ({ supplier, lines }, { payload, user }) => {
    await moduleOn();
    const po = await draftFromReorder(payload, supplier, lines);
    await audit(payload, { user: user.id, action: 'doc.create', collection: 'purchaseOrders', id: po.id, ref: po.title ?? null, after: { lines: lines.length } });
    return { id: po.id };
  },
);
