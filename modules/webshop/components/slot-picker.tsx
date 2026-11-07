'use client';

import { CalendarX2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useFieldError } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { addDays, today } from '@/lib/time';
import type { SlotDay } from '@/modules/sales/service';

export type SlotText = { pickTime: string; full: string; today: string; tomorrow: string; noDays: string; moreDates: string; fewerDates: string };

/** Open days shown before "See more dates": one week of chips, on every screen width (GG-008). */
const FIRST_DAYS = 7;

type Props = {
  /** null while the days load. */
  days: SlotDay[] | null;
  value: { date: string; time: string };
  onChange: (value: { date: string; time: string }) => void;
  locale: string;
  t: SlotText;
};

/**
 * The slot engine's days and times for one mode (05 §3.2 chips): a grid of day chips (the first week, then "See more
 * dates" for the rest of the booking window; nothing is cut off at the edge), then the times of the chosen day.
 * Full times are shown but disabled; the server recounts on submit, so a forged time is refused there too.
 */
export function SlotPicker({ days, value, onChange, locale, t }: Props) {
  const errors = [useFieldError('slot'), useFieldError('time'), useFieldError('date')];
  const [expanded, setExpanded] = useState(false);
  const error = errors.find(Boolean);
  const first = today();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });

  if (days === null) {
    return (
      <div className="space-y-5" aria-busy>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {Array.from({ length: FIRST_DAYS }, (_, i) => (
            <span key={i} className="h-[76px] animate-pulse rounded-2xl bg-champagne/70" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-9 animate-pulse rounded-full bg-champagne/70" />
          ))}
        </div>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-champagne/40 p-5 text-sm text-ink/70">
        <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
        <p>{t.noDays}</p>
      </div>
    );
  }

  const day = days.find((d) => d.date === value.date) ?? null;
  // A chosen day further away keeps the full list open.
  const forced = days.findIndex((d) => d.date === value.date) >= FIRST_DAYS;
  const open = expanded || forced;
  const shown = open ? days : days.slice(0, FIRST_DAYS);
  return (
    <div className="space-y-5">
      <input type="hidden" name="date" value={value.date} />
      <input type="hidden" name="time" value={value.time} />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label={t.pickTime}>
        {shown.map((d) => {
          const [y, m, dd] = d.date.split('-').map(Number);
          const at = new Date(Date.UTC(y, m - 1, dd));
          const label = d.date === first ? t.today : d.date === addDays(first, 1) ? t.tomorrow : weekday.format(at);
          const full = d.slots.every((s) => s.available === 0);
          const active = d.date === value.date;
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={full}
              onClick={() => onChange({ date: d.date, time: d.slots.some((s) => s.from === value.time && s.available > 0) ? value.time : '' })}
              className={cn(
                'flex h-[76px] min-w-0 flex-col items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-35',
                active ? 'border-ink bg-ink text-bone' : 'border-border bg-bone hover:border-ink',
              )}
            >
              <span className={cn('max-w-full truncate px-1 text-[9px] tracking-[0.12em] uppercase', active ? 'text-bone/70' : 'text-ink/50')}>{label}</span>
              <span className="font-serif text-2xl leading-none">{dd}</span>
              <span className={cn('text-[9px] tracking-[0.18em] uppercase', active ? 'text-gold' : 'text-gold-deep')}>{month.format(at)}</span>
            </button>
          );
        })}
      </div>
      {days.length > FIRST_DAYS && !forced && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setExpanded(!open)}
          className="flex items-center gap-1.5 border-b border-gold-deep text-[11px] tracking-[0.22em] text-gold-deep uppercase"
        >
          {open ? t.fewerDates : `${t.moreDates} (${days.length - FIRST_DAYS})`}
          <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
        </button>
      )}

      {day && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t.pickTime}>
          {day.slots.map((s) => {
            const full = s.available === 0;
            return (
              <Button
                key={s.from}
                type="button"
                variant="chip"
                size="sm"
                role="radio"
                aria-checked={value.time === s.from}
                active={value.time === s.from}
                disabled={full}
                onClick={() => onChange({ date: day.date, time: s.from })}
                className={cn('px-2 text-[12px] tracking-[0.08em] tabular-nums', full && 'line-through')}
                title={full ? t.full : undefined}
              >
                {s.from}
              </Button>
            );
          })}
        </div>
      )}
      {!value.time && !error && <p className="text-xs text-ink/50">{t.pickTime}</p>}
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
