'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { getAlerts } from './alerts';

/** The bell's and sidebar counters' refresh (alerts-client.tsx): any staff user, filtered by role in getAlerts. */
export const loadAlerts = action(z.object({}), { roles: [] }, (_input, { payload, user }) => getAlerts(payload, user));
