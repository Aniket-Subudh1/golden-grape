import { CalendarDays, ChevronLeft, ChevronRight, Clock, QrCode, ScanLine, TriangleAlert, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CorrectShift, ExportAttendance, TapCard } from '@/components/staff/attendance';
import { StaffPage } from '@/components/staff/page';
import { Empty, StaffTabs } from '@/components/staff/tabs';
import { hasRole } from '@/lib/access';
import { getPayloadClient } from '@/lib/payload';
import { hoursAndMinutes, today } from '@/lib/time';
import { verify } from '@/modules/attendance/qr-token';
import { attendanceSecret, monthlyReport, openShift, whoIsIn } from '@/modules/attendance/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Pointage' };

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="gg-card mx-auto flex max-w-md items-start gap-3 p-5 text-sm">
      <span className="text-gold-deep bg-champagne grid h-10 w-10 shrink-0 place-items-center rounded-[10px] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <p className="text-ink/75 pt-2">{children}</p>
    </div>
  );
}

/**
 * The time clock (M3.3 T3). An employee arrives from the venue QR (`?t=`) and taps one button. Managers also see who
 * is in now, the month's hours per person with corrections, and the CSV.
 */
export default async function AttendancePage({ searchParams }: PageProps<'/staff/attendance'>) {
  const sp = await searchParams;
  const token = typeof sp.t === 'string' ? sp.t : undefined;
  const { user, locale, t } = await requireStaff('attendance', `/staff/attendance${token ? `?t=${encodeURIComponent(token)}` : ''}`);
  const a = t.attendance;
  const payload = await getPayloadClient();
  const mine = await openShift(payload, user.id);
  const clock = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  const tap = !token ? (
    <Notice icon={<ScanLine />}>
      {mine ? `${a.since.replace('{{time}}', clock.format(new Date(mine.checkIn!)))}. ` : ''}
      {a.scanFirst}
    </Notice>
  ) : verify(token, new Date(), attendanceSecret()) ? (
    <TapCard token={token} since={mine?.checkIn ?? null} t={a} locale={locale} />
  ) : (
    <Notice icon={<TriangleAlert />}>{a.expired}</Notice>
  );

  if (!hasRole(user, ['manager'])) {
    return (
      <StaffPage title={a.title} back={{ href: '/staff', label: t.back }}>
        {tap}
      </StaffPage>
    );
  }

  const month = typeof sp.month === 'string' && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today().slice(0, 7);
  const [inNow, report] = await Promise.all([whoIsIn(payload), monthlyReport(payload, month)]);
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));
  const nameOf = (u: unknown) => (typeof u === 'object' && u !== null ? ((u as { name?: string }).name ?? '') : '');

  const now = (
    <div className="space-y-3">
      <Link href="/staff/attendance/qr" className="gg-card hover:border-ink/30 flex items-center gap-3 p-4 text-sm font-medium transition">
        <QrCode className="text-gold-deep h-5 w-5" aria-hidden />
        {a.qrTitle}
        <ChevronRight className="text-ink/40 ml-auto h-4 w-4" aria-hidden />
      </Link>
      {inNow.length === 0 ? (
        <Empty icon={<Users />} text={a.nobody} />
      ) : (
        <ul className="divide-border gg-card divide-y">
          {inNow.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm" data-in={nameOf(s.user)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{nameOf(s.user)}</span>
                <span className="text-ink/55 text-xs">{a.since.replace('{{time}}', clock.format(new Date(s.checkIn!)))}</span>
              </span>
              <CorrectShift shift={s.id} open checkIn={s.checkIn!} checkOut={null} t={a} back={t.back} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const monthView = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/staff/attendance?tab=month&month=${shiftMonth(month, -1)}`} aria-label={a.prev} className="border-border grid h-9 w-9 place-items-center rounded-lg border bg-white">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <p className="min-w-36 text-center font-medium capitalize">{monthName}</p>
        <Link href={`/staff/attendance?tab=month&month=${shiftMonth(month, 1)}`} aria-label={a.next} className="border-border grid h-9 w-9 place-items-center rounded-lg border bg-white">
          <ChevronRight className="h-4 w-4" />
        </Link>
        <span className="ml-auto">{report.people.length > 0 && <ExportAttendance month={month} t={a} />}</span>
      </div>
      {report.people.length === 0 ? (
        <Empty icon={<CalendarDays />} text={a.noShifts} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {report.people.map((p) => (
            <details key={p.id} className="gg-card group" data-person={p.name}>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="bg-gold-deep grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" aria-hidden>
                  {p.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.openShifts > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                      {a.missing} · {p.openShifts}
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums" data-testid="person-total">
                    {hoursAndMinutes(p.totalMinutes)}
                  </span>
                  <span className="text-ink/55 text-xs">{a.total}</span>
                </span>
              </summary>
              <ul className="divide-border border-border divide-y border-t">
                {report.shifts
                  .filter((s) => String(s.user) === p.id)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium capitalize">{dayFmt.format(new Date(`${s.day}T12:00:00Z`))}</span>
                        <span className="text-ink/60 inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden />
                          {clock.format(new Date(s.checkIn!))} – {s.checkOut ? clock.format(new Date(s.checkOut)) : <b className="text-amber-700">{a.missing}</b>}
                          {s.source === 'manager' && ` · ${a.corrected}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">{s.open ? '—' : hoursAndMinutes(s.minutes ?? 0)}</span>
                      <CorrectShift shift={s.id} open={Boolean(s.open)} checkIn={s.checkIn!} checkOut={s.checkOut ?? null} t={a} back={t.back} compact />
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );

  const tab = typeof sp.tab === 'string' ? sp.tab : token ? 'clock' : 'now';
  return (
    <StaffPage title={a.title} back={{ href: '/staff', label: t.back }} width="wide">
      <StaffTabs
        label={a.title}
        initial={tab}
        items={[
          { key: 'now', label: a.now, count: inNow.length, content: now },
          { key: 'month', label: a.month, content: monthView },
          { key: 'clock', label: a.mine, content: tap },
        ]}
      />
    </StaffPage>
  );
}
