import { describe, expect, it } from 'vitest';
import { earnedPoints, expirable } from './loyalty';

// Points are money for the customer: what an order earns and which points expire (oldest first).
describe('earnedPoints', () => {
  it('100 € charged at 1 point per euro → 100 points (AC-M3.2-08)', () => {
    expect(earnedPoints([{ totalCents: 10000, discountCents: 0, earns: true }], 0, 1)).toBe(100);
  });
  it('floors: 19,99 € → 19 points; the code share is not earned on', () => {
    expect(earnedPoints([{ totalCents: 2099, discountCents: 100, earns: true }], 0, 1)).toBe(19);
  });
  it('excluded lines and gift cards earn nothing; the points used are taken off first', () => {
    const lines = [
      { totalCents: 5000, discountCents: 0, earns: true },
      { totalCents: 5000, discountCents: 0, earns: false },
    ];
    expect(earnedPoints(lines, 1000, 2)).toBe(80);
  });
  it('never below 0', () => {
    expect(earnedPoints([{ totalCents: 500, discountCents: 0, earns: true }], 900, 1)).toBe(0);
  });
});

describe('expirable (FIFO)', () => {
  const NOW = new Date('2027-06-01T00:00:00Z');
  it('a lot past its date with points left expires them', () => {
    expect(expirable([{ id: 'a', points: 100, at: '2025-05-01', expiresAt: '2027-05-01' }], NOW)).toEqual([
      { lot: 'a', points: 100 },
    ]);
  });
  it('points used come from the oldest lot first: the old lot expires only what is left of it', () => {
    const rows = [
      { id: 'old', points: 100, at: '2025-05-01', expiresAt: '2027-05-01' },
      { id: 'new', points: 50, at: '2026-05-01', expiresAt: '2028-05-01' },
      { id: 'r', points: -70, at: '2026-06-01' },
    ];
    expect(expirable(rows, NOW)).toEqual([{ lot: 'old', points: 30 }]);
  });
  it('a spend larger than the old lot runs into the next one; an emptied lot expires nothing', () => {
    const rows = [
      { id: 'old', points: 100, at: '2025-05-01', expiresAt: '2027-05-01' },
      { id: 'new', points: 50, at: '2026-05-01', expiresAt: '2027-05-15' },
      { id: 'r', points: -120, at: '2026-06-01' },
    ];
    expect(expirable(rows, NOW)).toEqual([{ lot: 'new', points: 30 }]);
  });
  it('an expiry already written counts as used: nothing expires twice', () => {
    const rows = [
      { id: 'old', points: 100, at: '2025-05-01', expiresAt: '2027-05-01' },
      { id: 'x', points: -100, at: '2027-05-02' },
    ];
    expect(expirable(rows, NOW)).toEqual([]);
  });
  it('a lot without a date (a staff addition) never expires; one not yet due waits', () => {
    expect(
      expirable(
        [
          { id: 'a', points: 10, at: '2025-01-01' },
          { id: 'b', points: 5, at: '2026-01-01', expiresAt: '2027-12-01' },
        ],
        NOW,
      ),
    ).toEqual([]);
  });
});
