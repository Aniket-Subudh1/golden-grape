import { addDays, fromLocal, toLocal, today } from '@/lib/time';

// The one slot engine for pickup, delivery and table (M2.3 T1). Pure: times are Luxembourg wall-clock times and
// every conversion goes through lib/time.ts.

export type Hours = { day: string | number; open: string; close: string }[];
/** `lastCallMin` (GG-025): the last start is at least this long before closing (kitchen closes at 14:00, last table 13:30 → 30). */
export type SlotRule = { intervalMin: number; capacityPerSlot: number; leadTimeMin: number; maxDaysAhead: number; lastCallMin?: number | null; days?: Hours | null };
export type Slot = { from: string; to: string; available: number };

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** A closing time at or before the opening (00:00, 01:00 after a 17:00 opening) runs to midnight: slots never cross into the next day. */
const closing = (w: { open: string; close: string }) => (minutes(w.close) <= minutes(w.open) ? 24 * 60 : minutes(w.close));
const hhmm = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/**
 * The slots of `date` (`YYYY-MM-DD`): inside the opening hours (or the rule's own days), every `intervalMin`, starting
 * no earlier than `now + leadTimeMin`, within `maxDaysAhead`, none on a closed date. `available` = capacity minus what
 * is `taken` at that start time (orders, or guests for tables).
 */
export function generateSlots(input: { date: string; rule: SlotRule; hours: Hours; closedDates: string[]; now: Date; taken: Record<string, number> }): Slot[] {
  const { date, rule, hours, closedDates, now, taken } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || rule.intervalMin < 5) return [];
  const first = today(now);
  if (date < first || date > addDays(first, rule.maxDaysAhead) || closedDates.includes(date)) return [];
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const earliest = now.getTime() + rule.leadTimeMin * 60_000;
  const windows = (rule.days?.length ? rule.days : hours).filter((h) => Number(h.day) === weekday).sort((a, b) => minutes(a.open) - minutes(b.open));

  const slots: Slot[] = [];
  for (const w of windows) {
    for (let start = minutes(w.open); start + rule.intervalMin <= closing(w); start += rule.intervalMin) {
      const instant = fromLocal(y, m, d, Math.floor(start / 60), start % 60);
      const local = toLocal(instant);
      if (local.hour * 60 + local.minute !== start) continue; // skipped by the spring DST change
      if (instant.getTime() < earliest) continue;
      if (rule.lastCallMin && start > closing(w) - rule.lastCallMin) continue;
      const from = hhmm(start);
      slots.push({ from, to: hhmm(start + rule.intervalMin), available: Math.max(0, rule.capacityPerSlot - (taken[from] ?? 0)) });
    }
  }
  return slots;
}
