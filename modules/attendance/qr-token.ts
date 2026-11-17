import { createHmac, timingSafeEqual } from 'node:crypto';
import { addDays, today, toLocal } from '@/lib/time';

// The venue's daily attendance QR (M3.3 T2): a token for the Luxembourg day, signed with ATTENDANCE_SECRET. Yesterday's
// token still works until 03:00 so a night shift can check out after midnight; a photo of the QR is useless after that.

/** The token of a Luxembourg day (`YYYY-MM-DD`): base64url of the first 16 bytes of HMAC-SHA256("attendance:<day>"). */
export function dailyToken(day: string, secret: string) {
  return createHmac('sha256', secret).update(`attendance:${day}`).digest().subarray(0, 16).toString('base64url');
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** True for today's token, or yesterday's before 03:00 Luxembourg. Constant-time comparison. */
export function verify(token: string, now: Date, secret: string) {
  const day = today(now);
  if (same(token, dailyToken(day, secret))) return true;
  return toLocal(now).hour < 3 && same(token, dailyToken(addDays(day, -1), secret));
}
