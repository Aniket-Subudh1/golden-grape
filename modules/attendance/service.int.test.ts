import { describe, expect, it } from 'vitest';
import { fromLocal } from '@/lib/time';
import { getTestPayload, makeStaff, parallel } from '@/tests/helpers';
import { dailyToken } from './qr-token';
import { attendanceSecret, checkInOut, correctShift, monthlyReport, openShift, reportCsv } from './service';

// M3.3 T3 (AC-M3.3-04, AC-M3.3-05): one open shift per person whatever the taps; a correction closes a forgotten
// check-out and the hours reach the monthly report and its CSV.

const payload = await getTestPayload();
const at = (day: number, hour: number, minute = 0) => fromLocal(2026, 11, day, hour, minute);
const token = (day: string) => dailyToken(day, attendanceSecret());

describe('checkInOut', () => {
  it('two check-ins at once → one open shift; the next “out” closes it', async () => {
    const ana = await makeStaff(payload, ['attendance']);
    const now = at(17, 9);
    const results = await parallel(4, () => checkInOut(payload, { user: ana.id, token: token('2026-11-17'), intent: 'in', now }));
    expect(results.every((r) => r.status === 'fulfilled' && r.value.state === 'in')).toBe(true);
    const open = await payload.find({ collection: 'attendance', where: { user: { equals: ana.id } }, overrideAccess: true });
    expect(open.docs).toHaveLength(1);
    const out = await checkInOut(payload, { user: ana.id, token: token('2026-11-17'), intent: 'out', now: at(17, 17, 30) });
    expect(out).toMatchObject({ state: 'out', shift: { open: false, minutes: 510 } });
    expect(await openShift(payload, ana.id)).toBeNull();
  });

  it('yesterday’s QR: a night shift checks out at 01:30; after 03:00 the photo no longer works', async () => {
    const rui = await makeStaff(payload, ['attendance']);
    await checkInOut(payload, { user: rui.id, token: token('2026-11-17'), intent: 'in', now: at(17, 18) });
    const out = await checkInOut(payload, { user: rui.id, token: token('2026-11-17'), intent: 'out', now: at(18, 1, 30) });
    expect(out.shift).toMatchObject({ day: '2026-11-17', minutes: 450 });
    await expect(checkInOut(payload, { user: rui.id, token: token('2026-11-17'), intent: 'in', now: at(18, 3, 1) })).rejects.toMatchObject({ message: 'qrExpired' });
  });
});

describe('corrections and the monthly report', () => {
  it('a missing check-out set by a manager with a reason: hours in the report and the CSV, the correction kept', async () => {
    const eva = await makeStaff(payload, ['attendance'], { name: 'Eva Test' });
    const boss = await makeStaff(payload, ['manager']);
    await checkInOut(payload, { user: eva.id, token: token('2026-11-10'), intent: 'in', now: at(10, 8) });
    await checkInOut(payload, { user: eva.id, token: token('2026-11-10'), intent: 'out', now: at(10, 12) });
    const forgotten = await checkInOut(payload, { user: eva.id, token: token('2026-11-11'), intent: 'in', now: at(11, 8) });
    let report = await monthlyReport(payload, '2026-11');
    let row = report.people.find((p) => p.id === eva.id)!;
    expect(row).toMatchObject({ totalMinutes: 240, openShifts: 1, days: { '2026-11-11': { minutes: 0, open: true } } });

    await expect(correctShift(payload, { shift: forgotten.shift!.id, field: 'checkOut', at: at(11, 7), reason: 'forgot', by: boss.id, now: at(12, 9) })).rejects.toMatchObject({ message: 'outBeforeIn' });
    await expect(correctShift(payload, { shift: forgotten.shift!.id, field: 'checkOut', at: at(11, 16), reason: '  ', by: boss.id, now: at(12, 9) })).rejects.toMatchObject({ message: 'reasonRequired' });
    const { shift } = await correctShift(payload, { shift: forgotten.shift!.id, field: 'checkOut', at: at(11, 16, 15), reason: 'Forgot to scan out', by: boss.id, now: at(12, 9) });
    expect(shift).toMatchObject({ open: false, minutes: 495, source: 'manager' });
    const corrections = await payload.find({ collection: 'attendanceCorrections', where: { attendance: { equals: shift.id } }, overrideAccess: true, depth: 0 });
    expect(corrections.docs[0]).toMatchObject({ field: 'checkOut', reason: 'Forgot to scan out', by: boss.id });

    report = await monthlyReport(payload, '2026-11');
    row = report.people.find((p) => p.id === eva.id)!;
    expect(row).toMatchObject({ name: 'Eva Test', totalMinutes: 735, openShifts: 0 });
    const csv = reportCsv(report).rows.filter((r) => r[0] === 'Eva Test');
    expect(csv).toEqual([
      ['Eva Test', '2026-11-10', '4.00', ''],
      ['Eva Test', '2026-11-11', '8.25', ''],
      ['Eva Test', 'total', '12.25', ''],
    ]);
  });
});
