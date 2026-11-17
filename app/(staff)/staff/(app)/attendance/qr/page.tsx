import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { RefreshAfter } from '@/components/staff/attendance';
import { StaffPage } from '@/components/staff/page';
import { addDays, fromLocal, today } from '@/lib/time';
import { venueUrl } from '@/modules/attendance/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'QR de pointage' };

/**
 * The venue display (M3.3 T3): today's attendance QR, for a tablet kept open at the venue (manager session). It reloads
 * itself a few seconds after midnight, when the day's code changes.
 */
export default async function AttendanceQrPage() {
  const { locale, t } = await requireStaff('attendanceQr');
  const now = new Date();
  const url = venueUrl(now);
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#16181c', light: '#ffffff' } });
  const [y, m, d] = addDays(today(now), 1).split('-').map(Number);
  const untilMidnight = fromLocal(y, m, d).getTime() - now.getTime() + 5_000;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'Europe/Luxembourg' }).format(now);
  return (
    <StaffPage title={t.attendance.qrTitle} back={{ href: '/staff/attendance', label: t.back }} width="wide">
      <RefreshAfter ms={untilMidnight} />
      <div className="gg-card mx-auto grid max-w-xl justify-items-center gap-5 p-6 text-center md:p-10">
        <p className="text-ink/60 text-sm capitalize">{day}</p>
        {/* qrcode's own SVG output: generated here from our URL, no user input. */}
        <div className="w-full max-w-[min(70vh,420px)] [&_svg]:h-auto [&_svg]:w-full" data-testid="venue-qr" data-url={url} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-ink/70 max-w-sm text-sm">{t.attendance.qrText}</p>
      </div>
    </StaffPage>
  );
}
