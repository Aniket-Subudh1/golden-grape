import { createHmac } from 'node:crypto';
import type { Payload } from 'payload';
import { appUrl, env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { monthRange, today } from '@/lib/time';
import { withTx } from '@/lib/tx';
import type { Attendance } from '@/payload-types';
import { dailyToken, verify } from './qr-token';

// Attendance (M3.3 T3). The venue shows today's QR; an employee scans it and taps "Check in" or "Check out". The tap
// says what the button showed (`intent`), so a double tap or two phones at once never turn a check-in into a
// check-out: a second "in" finds the open shift and leaves it as it is. Managers correct a time with a reason.

/** ATTENDANCE_SECRET, or one derived from PAYLOAD_SECRET when it is not set (the QR stays private either way). */
export const attendanceSecret = () => env.ATTENDANCE_SECRET ?? createHmac('sha256', env.PAYLOAD_SECRET).update('attendance-qr').digest('hex');

/** The address today's venue QR encodes. */
export const venueUrl = (now = new Date()) => `${appUrl()}/staff/attendance?t=${dailyToken(today(now), attendanceSecret())}`;

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as { id: string }).id) : String(v));
const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));

/** The person's running shift, if any. */
export async function openShift(payload: Payload, user: string) {
  const { docs } = await payload.find({ collection: 'attendance', where: { user: { equals: user }, open: { equals: true } }, limit: 1, depth: 0, overrideAccess: true });
  return docs[0] ?? null;
}

/**
 * A tap on the attendance screen. The token must be today's (or yesterday's before 03:00). `in` opens a shift unless
 * one is open; `out` closes the open one, if any. Returns the person's state afterwards.
 */
export async function checkInOut(payload: Payload, { user, token, intent, now = new Date() }: { user: string; token: string; intent: 'in' | 'out'; now?: Date }) {
  if (!verify(token, now, attendanceSecret())) throw new AppError('FORBIDDEN', 'qrExpired', 't');
  const shift = await withTx(payload, async (tx) => {
    const { docs } = await tx.req.payload.find({ collection: 'attendance', where: { user: { equals: user }, open: { equals: true } }, limit: 1, depth: 0, overrideAccess: true, req: tx.req });
    const open = docs[0];
    if (intent === 'in') {
      if (open) return open;
      return tx.req.payload.create({ collection: 'attendance', data: { user, day: today(now), checkIn: now.toISOString(), open: true, source: 'qr' }, overrideAccess: true, depth: 0, req: tx.req });
    }
    if (!open) return null;
    return tx.req.payload.update({
      collection: 'attendance',
      id: open.id,
      data: { checkOut: now.toISOString(), open: false, minutes: minutesBetween(new Date(open.checkIn!), now) },
      overrideAccess: true,
      depth: 0,
      req: tx.req,
    });
  });
  return { state: shift?.open ? ('in' as const) : ('out' as const), shift };
}

/** Who is checked in now, earliest first. */
export async function whoIsIn(payload: Payload) {
  const { docs } = await payload.find({ collection: 'attendance', where: { open: { equals: true } }, sort: 'checkIn', limit: 100, depth: 1, overrideAccess: true });
  return docs;
}

/** A person's shifts, latest first (the manager's history). */
export async function shiftsOf(payload: Payload, user: string, limit = 30) {
  const { docs } = await payload.find({ collection: 'attendance', where: { user: { equals: user } }, sort: '-checkIn', limit, depth: 0, overrideAccess: true });
  return docs;
}

/**
 * A manager's correction (AC-M3.3-05): a check-in or check-out time, with a reason. Setting the check-out of an open
 * shift closes it. The shift, its correction row and its minutes change in one transaction; the action audits it.
 */
export async function correctShift(
  payload: Payload,
  { shift, field, at, reason, by, now = new Date() }: { shift: string; field: 'checkIn' | 'checkOut'; at: Date; reason: string; by: string; now?: Date },
) {
  if (reason.trim().length < 3) throw new AppError('VALIDATION', 'reasonRequired', 'reason');
  if (Number.isNaN(at.getTime()) || at > now) throw new AppError('VALIDATION', 'timeInFuture', 'at');
  return withTx(payload, async (tx) => {
    const row = await tx.req.payload.findByID({ collection: 'attendance', id: shift, depth: 0, overrideAccess: true, disableErrors: true, req: tx.req });
    if (!row) throw new AppError('NOT_FOUND', 'shift');
    const checkIn = field === 'checkIn' ? at : new Date(row.checkIn!);
    const checkOut = field === 'checkOut' ? at : row.checkOut ? new Date(row.checkOut) : null;
    if (checkOut && checkOut <= checkIn) throw new AppError('VALIDATION', 'outBeforeIn', 'at');
    if (checkOut && checkOut.getTime() - checkIn.getTime() > 24 * 3_600_000) throw new AppError('VALIDATION', 'shiftTooLong', 'at');
    const before = field === 'checkIn' ? row.checkIn : (row.checkOut ?? null);
    const updated = await tx.req.payload.update({
      collection: 'attendance',
      id: row.id,
      data: {
        day: today(checkIn),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut?.toISOString() ?? null,
        open: !checkOut,
        minutes: checkOut ? minutesBetween(checkIn, checkOut) : null,
        source: 'manager',
      },
      overrideAccess: true,
      depth: 0,
      req: tx.req,
    });
    await tx.req.payload.create({
      collection: 'attendanceCorrections',
      data: { attendance: row.id, field, before, after: at.toISOString(), reason: reason.trim(), by },
      overrideAccess: true,
      depth: 0,
      req: tx.req,
    });
    return { shift: updated, before };
  });
}

export type MonthlyReport = {
  month: string;
  days: string[];
  people: { id: string; name: string; days: Record<string, { minutes: number; open: boolean }>; totalMinutes: number; openShifts: number }[];
  /** The month's shifts, by check-in (the manager corrects them from the report). */
  shifts: Attendance[];
};

/**
 * Hours per person per day for a month (`YYYY-MM`), by the day of the check-in, and the total. An open shift counts 0
 * until corrected and is flagged. The admin view, the staff screen and the CSV all read this.
 */
export async function monthlyReport(payload: Payload, month: string): Promise<MonthlyReport> {
  const { start, end } = monthRange(month);
  const { docs } = await payload.find({
    collection: 'attendance',
    where: { day: { greater_than_equal: today(start), less_than: today(end) } },
    sort: 'checkIn',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const ids = [...new Set(docs.map((d) => idOf(d.user)))];
  const users = ids.length ? (await payload.find({ collection: 'users', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, select: { name: true } })).docs : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? '']));
  const people = new Map<string, MonthlyReport['people'][number]>();
  for (const d of docs as Attendance[]) {
    const id = idOf(d.user);
    const person = people.get(id) ?? { id, name: nameOf.get(id) ?? '—', days: {}, totalMinutes: 0, openShifts: 0 };
    const day = (person.days[d.day] ??= { minutes: 0, open: false });
    if (d.open) {
      day.open = true;
      person.openShifts++;
    } else {
      day.minutes += d.minutes ?? 0;
      person.totalMinutes += d.minutes ?? 0;
    }
    people.set(id, person);
  }
  return {
    month,
    days: [...new Set(docs.map((d) => d.day))].sort(),
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    shifts: docs,
  };
}

/** The report as CSV rows: one per person and day worked, then the person's total (hours with two decimals). */
export function reportCsv(report: MonthlyReport) {
  const hours = (minutes: number) => (minutes / 60).toFixed(2);
  const rows: string[][] = [];
  for (const p of report.people) {
    for (const day of Object.keys(p.days).sort()) rows.push([p.name, day, hours(p.days[day].minutes), p.days[day].open ? 'open' : '']);
    rows.push([p.name, 'total', hours(p.totalMinutes), p.openShifts ? `${p.openShifts} open` : '']);
  }
  return { name: `golden-grape-attendance-${report.month}.csv`, headers: ['employee', 'date', 'hours', 'note'], rows };
}
