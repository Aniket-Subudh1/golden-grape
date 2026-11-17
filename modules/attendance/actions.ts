'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { toCsv } from '@/lib/table';
import { fromLocal } from '@/lib/time';
import { rateLimit } from '@/lib/rate-limit';
import { isModuleOn } from '@/modules/settings/service';
import { checkInOut, correctShift, monthlyReport, reportCsv } from './service';

// Attendance (M3.3 T3): the tap on the venue QR (anyone with the attendance role, and managers), a manager's
// correction with its reason (audited), the monthly CSV. Each one refuses when the module is off.

const moduleOn = async () => {
  if (!(await isModuleOn('attendance'))) throw new AppError('NOT_FOUND', 'module');
};

/** Check in or out with today's QR token; one tap per 30 s per person. */
export const tapAttendance = action(z.object({ t: z.string().min(1).max(64), intent: z.enum(['in', 'out']) }), { roles: ['attendance', 'manager'] }, async ({ t, intent }, { payload, user }) => {
  await moduleOn();
  await rateLimit(`attendance:${user.id}`, 1, 30_000);
  const { state, shift } = await checkInOut(payload, { user: user.id, token: t, intent });
  return { state, checkIn: shift?.checkIn ?? null, checkOut: shift?.checkOut ?? null, minutes: shift?.minutes ?? null };
});

/** A Luxembourg wall-clock time from the form (`YYYY-MM-DDTHH:mm`). */
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'time');

export const correctShiftAction = action(
  z.object({ shift: z.string().min(1).max(40), field: z.enum(['checkIn', 'checkOut']), at: localTime, reason: z.string().trim().min(3, 'reasonRequired').max(200, 'tooLong') }),
  { roles: ['manager'] },
  async ({ shift, field, at, reason }, { payload, user }) => {
    await moduleOn();
    const [day, time] = at.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const result = await correctShift(payload, { shift, field, at: fromLocal(y, m, d, h, min), reason, by: user.id });
    await audit(payload, { user: user.id, action: 'attendance.corrected', collection: 'attendance', id: shift, ref: result.shift.day, reason, before: { [field]: result.before }, after: { [field]: result.shift[field] } });
    return { minutes: result.shift.minutes ?? null };
  },
);

export const exportAttendance = action(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }), { roles: ['manager'] }, async ({ month }, { payload }) => {
  await moduleOn();
  const { name, headers, rows } = reportCsv(await monthlyReport(payload, month));
  return { name, csv: toCsv(headers, rows), rows: rows.length };
});
