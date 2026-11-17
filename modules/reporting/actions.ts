'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { toCsv } from '@/lib/table';
import { CHANNELS, GROUP_BY, salesBy, salesCsv } from './service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The dashboard's table as CSV (admin and managers). */
export const exportSales = action(
  z.object({ from: day, to: day, groupBy: z.enum(GROUP_BY), channel: z.enum(CHANNELS).optional(), locale: z.enum(['fr', 'en', 'de', 'pt']), none: z.string().max(40), total: z.string().max(40) }).refine((r) => r.from <= r.to, { path: ['to'], message: 'range' }),
  { roles: ['manager'] },
  async ({ none, total: totalLabel, ...query }, { payload }) => {
    const { total, groups } = await salesBy(payload, query);
    const { headers, rows } = salesCsv(groups, total, query.groupBy, { none, total: totalLabel });
    return { name: `golden-grape-sales-${query.groupBy}-${query.from}-${query.to}.csv`, csv: toCsv(headers, rows) };
  },
);
