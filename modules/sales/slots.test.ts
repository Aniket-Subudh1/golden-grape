import { describe, expect, it } from 'vitest';
import { generateSlots, type Hours, type SlotRule } from './slots';

const rule: SlotRule = { intervalMin: 30, capacityPerSlot: 6, leadTimeMin: 60, maxDaysAhead: 14 };
const hours: Hours = [1, 2, 3, 4, 5].map((day) => ({ day: String(day), open: '10:00', close: '18:00' }));
// Monday 9 Nov 2026, 08:00 in Luxembourg (07:00 UTC, winter time).
const NOW = new Date('2026-11-09T07:00:00Z');
const run = (over: Partial<Parameters<typeof generateSlots>[0]> = {}) =>
  generateSlots({ date: '2026-11-10', rule, hours, closedDates: [], now: NOW, taken: {}, ...over });

describe('generateSlots', () => {
  it('a normal day: 30-minute slots from opening, the last one ending at closing time', () => {
    const slots = run();
    expect(slots).toHaveLength(16);
    expect(slots[0]).toEqual({ from: '10:00', to: '10:30', available: 6 });
    expect(slots.at(-1)).toEqual({ from: '17:30', to: '18:00', available: 6 });
  });

  it('the lead time cuts the first slots of today', () => {
    // 10:20 local: with 60 min lead, the first slot starts at 11:30.
    const slots = run({ date: '2026-11-09', now: new Date('2026-11-09T09:20:00Z') });
    expect(slots[0].from).toBe('11:30');
  });

  it('a closed date has no slot', () => {
    expect(run({ closedDates: ['2026-11-10'] })).toEqual([]);
  });

  it('a day without opening hours has no slot', () => {
    expect(run({ date: '2026-11-15' })).toEqual([]); // Sunday
  });

  it('a slot at capacity is available 0; others keep their room', () => {
    const slots = run({ taken: { '12:00': 6, '12:30': 2 } });
    expect(slots.find((s) => s.from === '12:00')?.available).toBe(0);
    expect(slots.find((s) => s.from === '12:30')?.available).toBe(4);
  });

  it('table capacity counts guests', () => {
    const table: SlotRule = { ...rule, intervalMin: 60, capacityPerSlot: 20 };
    expect(run({ rule: table, taken: { '19:00': 18 } }).find((s) => s.from === '13:00')?.available).toBe(20);
    expect(generateSlots({ date: '2026-11-10', rule: table, hours: [{ day: '2', open: '18:00', close: '22:00' }], closedDates: [], now: NOW, taken: { '19:00': 18 } })).toEqual([
      { from: '18:00', to: '19:00', available: 20 },
      { from: '19:00', to: '20:00', available: 2 },
      { from: '20:00', to: '21:00', available: 20 },
      { from: '21:00', to: '22:00', available: 20 },
    ]);
  });

  it('the rule’s own days replace the opening hours', () => {
    expect(run({ rule: { ...rule, days: [{ day: 2, open: '12:00', close: '13:00' }] } }).map((s) => s.from)).toEqual(['12:00', '12:30']);
  });

  it('maxDaysAhead is the last bookable day; one more day is empty', () => {
    expect(run({ date: '2026-11-23' })).toHaveLength(16); // today + 14, a Monday
    expect(run({ date: '2026-11-24' })).toEqual([]); // today + 15
  });

  it('closing at midnight (00:00) or later runs to midnight: the last slot ends at 24:00, none crosses into the next day (GG-009)', () => {
    const late: Hours = [{ day: '2', open: '17:00', close: '00:00' }];
    const slots = run({ hours: late });
    expect(slots[0].from).toBe('17:00');
    expect(slots.at(-1)).toEqual({ from: '23:30', to: '24:00', available: 6 });
    expect(run({ hours: [{ day: '2', open: '17:00', close: '01:00' }] })).toHaveLength(14);
  });

  it('today after the last slot minus the lead time: nothing left today (GG-009)', () => {
    // 17:05 local: 18:05 earliest, after the last 17:30 start.
    expect(run({ date: '2026-11-09', now: new Date('2026-11-09T16:05:00Z') })).toEqual([]);
  });

  it('every rule at once, as configured by the shop: 30 min, 4 per slot, 60 min notice, 14 days, closed Sunday and on a holiday (GG-009)', () => {
    const shop: SlotRule = { intervalMin: 30, capacityPerSlot: 4, leadTimeMin: 60, maxDaysAhead: 14 };
    const week: Hours = [1, 2, 3, 4, 5, 6].map((day) => ({ day: String(day), open: '10:00', close: '18:00' }));
    // Saturday 7 Nov 2026, 13:02 local.
    const now = new Date('2026-11-07T12:02:00Z');
    const day = (date: string, over: Partial<Parameters<typeof generateSlots>[0]> = {}) => generateSlots({ date, rule: shop, hours: week, closedDates: ['2026-11-11'], now, taken: {}, ...over });
    expect(day('2026-11-06')).toEqual([]); // yesterday
    expect(day('2026-11-07')[0].from).toBe('14:30'); // 13:02 + 60 min → the next half hour
    expect(day('2026-11-08')).toEqual([]); // Sunday
    expect(day('2026-11-11')).toEqual([]); // holiday
    expect(day('2026-11-21')).toHaveLength(16); // today + 14
    expect(day('2026-11-22')).toEqual([]); // beyond the window
    expect(day('2026-11-09', { taken: { '10:00': 4, '10:30': 3 } }).slice(0, 2).map((s) => s.available)).toEqual([0, 1]);
  });

  it('last arrival before closing (GG-025): closing 14:00 with 30 min → the last start is 13:30, whatever the step', () => {
    const lunch: Hours = [{ day: '2', open: '12:00', close: '14:00' }];
    const every15 = { ...rule, intervalMin: 15 };
    expect(run({ hours: lunch, rule: every15 }).at(-1)?.from).toBe('13:45');
    expect(run({ hours: lunch, rule: { ...every15, lastCallMin: 30 } }).at(-1)?.from).toBe('13:30');
    expect(run({ hours: lunch, rule: { ...every15, lastCallMin: 45 } }).at(-1)?.from).toBe('13:15');
    expect(run({ hours: lunch, rule: { ...rule, lastCallMin: 0 } }).at(-1)?.from).toBe('13:30');
  });

  it('a past date is empty', () => {
    expect(run({ date: '2026-11-06' })).toEqual([]);
  });

  it('the spring DST day never yields a local time that does not exist', () => {
    // Sunday 28 Mar 2027: 02:00 → 03:00 in Luxembourg. A night window over the change.
    const night: Hours = [{ day: 0, open: '01:00', close: '04:00' }];
    const slots = generateSlots({ date: '2027-03-28', rule: { ...rule, leadTimeMin: 0 }, hours: night, closedDates: [], now: new Date('2027-03-27T12:00:00Z'), taken: {} });
    expect(slots.map((s) => s.from)).toEqual(['01:00', '01:30', '03:00', '03:30']);
  });

  it('the autumn DST day keeps every wall-clock slot once', () => {
    const slots = generateSlots({ date: '2026-10-25', rule: { ...rule, leadTimeMin: 0 }, hours: [{ day: 0, open: '10:00', close: '12:00' }], closedDates: [], now: new Date('2026-10-24T12:00:00Z'), taken: {} });
    expect(slots.map((s) => s.from)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });
});
