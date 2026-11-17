import { describe, expect, it } from 'vitest';
import { fromLocal } from '@/lib/time';
import { dailyToken, verify } from './qr-token';

const SECRET = 'attendance-test-secret-0123456789';
const tok = (day: string) => dailyToken(day, SECRET);

describe('attendance QR token', () => {
  it('today’s token is valid all day', () => {
    expect(verify(tok('2026-11-17'), fromLocal(2026, 11, 17, 0, 0), SECRET)).toBe(true);
    expect(verify(tok('2026-11-17'), fromLocal(2026, 11, 17, 23, 59), SECRET)).toBe(true);
  });

  it('yesterday’s token: valid at 02:59, refused at 03:01', () => {
    expect(verify(tok('2026-11-16'), fromLocal(2026, 11, 17, 2, 59), SECRET)).toBe(true);
    expect(verify(tok('2026-11-16'), fromLocal(2026, 11, 17, 3, 1), SECRET)).toBe(false);
  });

  it('tomorrow’s and older tokens are refused', () => {
    expect(verify(tok('2026-11-18'), fromLocal(2026, 11, 17, 12), SECRET)).toBe(false);
    expect(verify(tok('2026-11-15'), fromLocal(2026, 11, 17, 1), SECRET)).toBe(false);
  });

  it('a tampered token, another secret or garbage is refused', () => {
    const t = tok('2026-11-17');
    const at = fromLocal(2026, 11, 17, 12);
    expect(verify(`${t.slice(0, -1)}${t.endsWith('A') ? 'B' : 'A'}`, at, SECRET)).toBe(false);
    expect(verify(dailyToken('2026-11-17', 'another-secret-0123456789abcdef'), at, SECRET)).toBe(false);
    expect(verify('', at, SECRET)).toBe(false);
    expect(verify('x'.repeat(200), at, SECRET)).toBe(false);
  });

  it('16 bytes, URL-safe, one per day', () => {
    expect(tok('2026-11-17')).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tok('2026-11-17')).not.toBe(tok('2026-11-18'));
  });

  it('DST days use the Luxembourg day: 29 March and 25 October 2026', () => {
    // 29 March: 02:00 → 03:00. 00:30 UTC on the 29th is 01:30 local on the 29th.
    expect(verify(tok('2026-03-29'), new Date('2026-03-29T00:30:00Z'), SECRET)).toBe(true);
    // 01:30 local on the 29th is before 03:00: yesterday’s token still works.
    expect(verify(tok('2026-03-28'), new Date('2026-03-29T00:30:00Z'), SECRET)).toBe(true);
    // 02:30 UTC on the 29th is 04:30 local (summer time): yesterday’s is refused.
    expect(verify(tok('2026-03-28'), new Date('2026-03-29T02:30:00Z'), SECRET)).toBe(false);
    // 25 October: 03:00 → 02:00. 23:30 UTC on the 24th is 01:30 local on the 25th.
    expect(verify(tok('2026-10-25'), new Date('2026-10-24T23:30:00Z'), SECRET)).toBe(true);
    expect(verify(tok('2026-10-24'), new Date('2026-10-25T01:30:00Z'), SECRET)).toBe(true); // 02:30 local, winter
    expect(verify(tok('2026-10-24'), new Date('2026-10-25T02:30:00Z'), SECRET)).toBe(false); // 03:30 local
  });
});
