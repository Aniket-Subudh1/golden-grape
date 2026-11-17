'use server';

import { z } from 'zod';
import { clientIp, publicAction } from '@/lib/action';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { normalizeCode } from './codes';

/**
 * A gift card's balance, by its code (the account's "check a card"). Ten tries per 10 minutes per address: a code is
 * worth money, so guessing is slowed down. Answers only the balance and the date, never who bought it.
 */
export const giftCardBalance = publicAction(
  z.object({ code: z.string().trim().min(4).max(40) }),
  async ({ code }, { payload }) => {
    await rateLimit(`giftcard:${await clientIp()}`, 10, 10 * 60_000);
    const { docs } = await payload.find({
      collection: 'giftCards',
      where: { code: { equals: normalizeCode(code) } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
    });
    const card = docs[0];
    if (!card) throw new AppError('NOT_FOUND', 'cardUnknown', 'code');
    if (card.status === 'void') throw new AppError('CONFLICT', 'cardVoid', 'code');
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) throw new AppError('CONFLICT', 'cardExpired', 'code');
    return { balanceCents: card.balanceCents ?? 0, expiresAt: card.expiresAt ?? null };
  },
);
