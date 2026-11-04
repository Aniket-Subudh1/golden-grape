'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { withTx } from '@/lib/tx';
import { ADJUST_REASONS } from './labels';
import { adjust, postCount, setLowStockThreshold } from './service';

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
  (input, { payload, user }) =>
    adjust(payload, { variant: input.variant, qty: input.qty, reason: input.reason === 'other' ? (input.note as string) : input.reason, user: user.id }),
);

export const setLowStockAlert = action(
  z.object({ variant: z.string().min(1), threshold: z.union([z.literal(''), z.coerce.number().int().min(0)]) }),
  roles,
  (input, { payload }) => withTx(payload, (tx) => setLowStockThreshold(tx, input.variant, input.threshold === '' ? null : input.threshold)),
);

export const postStockCount = action(z.object({ count: z.string().min(1) }), roles, (input, { payload, user }) => postCount(payload, input.count, user.id));
