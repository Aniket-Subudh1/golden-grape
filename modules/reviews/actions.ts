'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { refreshReviews } from './service';

/** "Refresh now" on the admin's review overview (managers). */
export const refreshReviewsAction = action(z.object({}), { roles: ['manager'] }, async (_, { payload }) => refreshReviews(payload));
