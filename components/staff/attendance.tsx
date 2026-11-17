'use client';

import { Download, LogIn, LogOut, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveFile } from '@/components/admin/save-file';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { hoursAndMinutes } from '@/lib/time';
import { correctShiftAction, exportAttendance, tapAttendance } from '@/modules/attendance/actions';
import { celebrate, done } from './feedback';
import { SuccessTick } from './success-tick';

// The attendance screen's moving parts (M3.3 T3): the one big button, a manager's correction in a pop-up, the
// monthly CSV, and the venue QR's refresh after midnight.

type Texts = Dictionary['staff']['attendance'];

const time = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'Europe/Luxembourg' }).format(new Date(iso));

const errorOf = (t: Texts, r: { error: string; message?: string; fieldErrors?: Record<string, string[]> }) => {
  const key = r.message ?? Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error;
  return (t.errors as Record<string, string>)[key] ?? (t.errors as Record<string, string>)[r.error] ?? t.error;
};

/** The employee's button: "Check in" or "Check out" by their open shift, then a tick and the time. */
export function TapCard({ token, since, t, locale }: { token: string; since: string | null; t: Texts; locale: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const intent = since ? 'out' : 'in';
  const tap = () =>
    start(async () => {
      const r = await tapAttendance(null, { t: token, intent });
      if (!r.ok) return void toast.error(errorOf(t, r));
      celebrate();
      setResult(
        r.data.state === 'in'
          ? interpolate(t.doneIn, { time: time(r.data.checkIn!, locale) })
          : interpolate(t.doneOut, { time: time(r.data.checkOut ?? new Date().toISOString(), locale), hours: hoursAndMinutes(r.data.minutes ?? 0) }),
      );
      router.refresh();
    });
  if (result) {
    return (
      <div className="gg-card mx-auto max-w-md space-y-3 p-6 text-center" role="status">
        <SuccessTick />
        <p className="text-lg font-semibold" data-testid="attendance-result">
          {result}
        </p>
      </div>
    );
  }
  return (
    <div className="gg-card mx-auto max-w-md space-y-5 p-6 text-center">
      <p className="text-ink/70 text-sm" data-testid="attendance-state">
        {since ? interpolate(t.since, { time: time(since, locale) }) : t.notIn}
      </p>
      <Button type="button" onClick={tap} disabled={pending} className="h-16 w-full text-lg" variant={since ? 'outline' : 'solid'}>
        {since ? <LogOut className="h-5 w-5" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
        {since ? t.out : t.in}
      </Button>
    </div>
  );
}

/** A manager's correction: which time, the right time (Luxembourg), a reason. */
/** `compact`: icon only on phones (the month's shift rows), the words from tablets up. */
export function CorrectShift({ shift, open, checkIn, checkOut, t, back, compact = false }: { shift: string; open: boolean; checkIn: string; checkOut: string | null; t: Texts; back: string; compact?: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [field, setField] = useState<'checkIn' | 'checkOut'>(open ? 'checkOut' : 'checkIn');
  const [pending, start] = useTransition();
  const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Luxembourg' }).slice(0, 16).replace(' ', 'T') : '');
  const submit = (form: HTMLFormElement) =>
    start(async () => {
      const data = new FormData(form);
      data.set('shift', shift);
      data.set('field', field);
      const r = await correctShiftAction(null, data);
      if (!r.ok) return void toast.error(errorOf(t, r));
      done();
      toast.success(t.saved);
      setShow(false);
      router.refresh();
    });
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          // Each opening starts on the time this button is about (a running shift: its check-out).
          setField(open ? 'checkOut' : 'checkIn');
          setShow(true);
        }}
        className="border-border shrink-0"
        aria-label={open ? t.setOut : t.correct}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        <span className={compact ? 'hidden sm:inline' : undefined}>{open ? t.setOut : t.correct}</span>
      </Button>
      <Sheet open={show} onOpenChange={setShow} label={t.correct} closeLabel={back} variant="bottom">
        <form
          className="space-y-4 p-5 pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <h2 className="pr-10 font-serif text-2xl">{open ? t.setOut : t.correct}</h2>
          <fieldset className="space-y-1">
            <legend className="eyebrow text-ink/60 mb-1">{t.field}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['checkIn', 'checkOut'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={field === f}
                  onClick={() => setField(f)}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${field === f ? 'border-ink bg-ink text-white' : 'border-border bg-white'}`}
                >
                  {t[f]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="eyebrow text-ink/60 mb-1 block">{t.at}</span>
            <input
              key={field}
              name="at"
              type="datetime-local"
              required
              defaultValue={field === 'checkIn' ? local(checkIn) : local(checkOut ?? checkIn)}
              className="border-border h-11 w-full rounded-lg border bg-white px-3 text-base"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink/60 mb-1 block">{t.reason}</span>
            <input name="reason" required minLength={3} maxLength={200} placeholder={t.reasonPh} className="border-border h-11 w-full rounded-lg border bg-white px-3 text-base" />
          </label>
          <Button type="submit" disabled={pending} className="w-full">
            {t.save}
          </Button>
        </form>
      </Sheet>
    </>
  );
}

export function ExportAttendance({ month, t }: { month: string; t: Texts }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      className="border-border"
      onClick={() =>
        start(async () => {
          const r = await exportAttendance(null, { month });
          if (!r.ok) return void toast.error(t.error);
          saveFile(r.data.name, r.data.csv);
        })
      }
    >
      <Download className="h-4 w-4" aria-hidden />
      {t.export}
    </Button>
  );
}

/** Reloads the page a few seconds after the next Luxembourg midnight (the venue QR changes then). */
export function RefreshAfter({ ms }: { ms: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setTimeout(() => router.refresh(), ms);
    return () => clearTimeout(id);
  }, [ms, router]);
  return null;
}
