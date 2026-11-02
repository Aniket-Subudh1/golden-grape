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
function fromLocal(year: number, month: number, day: number) {
  const wall = Date.UTC(year, month - 1, day);
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
