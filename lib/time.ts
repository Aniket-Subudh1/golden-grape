// The only place that knows the business timezone.
export const TZ = 'Europe/Luxembourg';

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Wall-clock fields of an instant in Luxembourg. `weekday` is 0 (Sunday) to 6. */
export function toLocal(date: Date = new Date()) {
  const p = Object.fromEntries(parts.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Today's date in Luxembourg as `YYYY-MM-DD`. */
export function today(now: Date = new Date()) {
  const { year, month, day } = toLocal(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Converts a Luxembourg wall-clock time to the instant it denotes (handles the DST offset).
function fromLocal(year: number, month: number, day: number, hour = 0, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => {
    const l = toLocal(new Date(instant));
    return Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second) - instant;
  };
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}

/** The instant at which the Luxembourg day containing `date` starts. */
export function startOfDay(date: Date = new Date()) {
  const { year, month, day } = toLocal(date);
  return fromLocal(year, month, day);
}

/** `[start, end)` instants of a Luxembourg calendar month given as `YYYY-MM`. */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { start: fromLocal(y, m, 1), end: fromLocal(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) };
}

/** Next instant after `now` that falls on one of `weekdays` (0 = Sunday) at `time` (`HH:mm`) in Luxembourg. */
export function nextWeekly(weekdays: number[], time: string, now: Date = new Date()) {
  const [hour, minute] = time.split(':').map(Number);
  const { year, month, day } = toLocal(now);
  for (let i = 0; i < 8; i++) {
    const date = new Date(Date.UTC(year, month - 1, day + i));
    const candidate = fromLocal(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute);
    if (weekdays.includes(date.getUTCDay()) && candidate > now) return candidate;
  }
  throw new Error('nextWeekly: no weekday given');
}


type Slot = { day: string; open: string; close: string };

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Monday-first week: each day's name in `locale` and its slots ("10:00 — 18:00"); `slots` is '' when closed. */
export function weekHours(hours: Slot[], locale: string) {
  const name = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return MONDAY_FIRST.map((day) => ({
    day: capitalize(name.format(new Date(Date.UTC(2024, 0, 7 + day)))), // 7 Jan 2024 is a Sunday
    slots: hours
      .filter((h) => Number(h.day) === day)
      .sort((a, b) => minutes(a.open) - minutes(b.open))
      .map((h) => `${h.open} — ${h.close}`)
      .join(', '),
  }));
}

/** Open days with consecutive equal slots merged: `[{ days: 'Lundi — Vendredi', slots: '10:00 — 18:00' }]`. */
export function groupedHours(hours: Slot[], locale: string) {
  const groups: { first: string; last: string; slots: string }[] = [];
  for (const { day, slots } of weekHours(hours, locale)) {
    const prev = groups.at(-1);
    if (slots && prev?.slots === slots) prev.last = day;
    else groups.push({ first: day, last: day, slots });
  }
  return groups
    .filter((g) => g.slots)
    .map((g) => ({ days: g.first === g.last ? g.first : `${g.first} — ${g.last}`, slots: g.slots }));
}

/** Whether the shop is open at `now` in Luxembourg. */
export function isOpenNow(hours: Slot[], closedDates: { date: string }[], now: Date = new Date()) {
  if (closedDates.some((c) => today(new Date(c.date)) === today(now))) return false;
  const local = toLocal(now);
  const current = local.hour * 60 + local.minute;
  return hours.some((h) => Number(h.day) === local.weekday && minutes(h.open) <= current && current < minutes(h.close));
}

/** Event date and time range in Luxembourg: `{ date: 'Vendredi 8 août', time: '19:00 — 23:00' }`. */
export function eventDate(startsAt: string, endsAt: string | null | undefined, locale: string) {
  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
  const start = new Date(startsAt);
  return {
    date: capitalize(date.format(start)),
    time: endsAt ? `${time.format(start)} — ${time.format(new Date(endsAt))}` : time.format(start),
  };
}

/** `addDays('2026-11-02', 2)` → `'2026-11-04'` (calendar arithmetic on a `YYYY-MM-DD` date). */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
