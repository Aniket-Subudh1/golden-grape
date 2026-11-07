'use client';

import { useForm, useTranslation } from '@payloadcms/ui';
import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import { l, type Label, QUARTER_HOURS, WEEKDAYS } from '@/lib/admin';

// "Same hours for several days" (GG-023), above an array of { day, open, close } rows: the shop's opening hours and a
// slot rule's own hours. Tick the days, pick the times, apply: the rows are written into the list below as if typed
// one by one (nothing is saved until Save). The stored rows keep their shape, so the website and the slot engine
// read them exactly as before.

const T = {
  title: l('Mêmes horaires pour plusieurs jours', 'Same hours for several days', 'Gleiche Zeiten für mehrere Tage', 'Mesmo horário para vários dias'),
  days: l('Jours', 'Days', 'Tage', 'Dias'),
  weekdays: l('Lun.–ven.', 'Mon–Fri', 'Mo–Fr', 'Seg–Sex'),
  from: l('De', 'From', 'Von', 'De'),
  to: l('À', 'To', 'Bis', 'Até'),
  replace: l(
    'Remplacer les horaires déjà saisis pour ces jours (décochez pour ajouter une 2e plage, par ex. le soir)',
    'Replace the hours already entered for these days (untick to add a 2nd range, e.g. the evening)',
    'Bereits eingetragene Zeiten dieser Tage ersetzen (abwählen, um einen 2. Zeitraum hinzuzufügen, z. B. abends)',
    'Substituir o horário já indicado para estes dias (desmarque para juntar um 2.º período, p. ex. à noite)',
  ),
  apply: l('Appliquer aux jours cochés', 'Apply to the ticked days', 'Auf die gewählten Tage anwenden', 'Aplicar aos dias marcados'),
  noDay: l('Cochez au moins un jour.', 'Tick at least one day.', 'Wählen Sie mindestens einen Tag.', 'Marque pelo menos um dia.'),
  order: l(
    'L’heure de fin doit suivre l’heure de début (00:00 = minuit).',
    'The end must come after the start (00:00 = midnight).',
    'Das Ende muss nach dem Beginn liegen (00:00 = Mitternacht).',
    'O fim deve vir depois do início (00:00 = meia-noite).',
  ),
  done: l('Ajouté à la liste : enregistrez pour valider.', 'Added to the list: save to keep it.', 'Zur Liste hinzugefügt: zum Übernehmen speichern.', 'Juntado à lista: guarde para manter.'),
};

/** Monday first, Sunday last, as people read a week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

type Row = { day?: string | null; open?: string | null; close?: string | null };

export default function WeekdayBulk({ path, array }: { path: string; array: string }) {
  const { i18n } = useTranslation();
  const say = (label: Label) => label[i18n.language as keyof Label] ?? label.fr;
  const { addFieldRow, removeFieldRow, getDataByPath, getFields, dispatchFields, setModified } = useForm();
  // The list sits beside this field: same parent path, its own name.
  const arrayPath = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.${array}` : array;
  const [days, setDays] = useState<number[]>([]);
  const [open, setOpen] = useState('10:00');
  const [close, setClose] = useState('18:00');
  const [replace, setReplace] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (day: number) => setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));

  const [busy, setBusy] = useState(false);

  /** Writes day, opening and closing into row `i`, as if chosen in its selects. */
  const fill = (i: number, day: number) => {
    for (const [name, value] of [['day', String(day)], ['open', open], ['close', close]] as const) {
      dispatchFields({ type: 'UPDATE', path: `${arrayPath}.${i}.${name}`, value, valid: true });
    }
  };

  // A row added from scratch is filled in by a round trip to the server; wait for it before copying it.
  const loaded = async () => {
    for (let n = 0; n < 50; n++) {
      if (!getFields()[arrayPath]?.rows?.some((r) => r.isLoading)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  // Rows are written with Payload's own row actions: change a kept row, copy the last row (as "Duplicate" does), never
  // fill a blank new row (the server's answer for a new row would empty it again).
  async function apply() {
    if (days.length === 0) return setMessage(say(T.noDay));
    if (close !== '00:00' && close <= open) return setMessage(say(T.order));
    setBusy(true);
    const rows = (getDataByPath(arrayPath) as Row[] | undefined) ?? [];
    const queue = WEEK.filter((d) => days.includes(d));
    const chosen = (r: Row) => days.includes(Number(r?.day));
    // Replacing every row would leave nothing to copy: the first one is kept and rewritten instead.
    const keepFirst = replace && rows.length > 0 && rows.every(chosen);
    if (replace) {
      // From the last row up, so the indexes still to remove do not move.
      for (let i = rows.length - 1; i >= (keepFirst ? 1 : 0); i--) if (chosen(rows[i])) removeFieldRow({ path: arrayPath, rowIndex: i });
    }
    let count = replace ? rows.filter((r, i) => !chosen(r) || (keepFirst && i === 0)).length : rows.length;
    if (keepFirst) fill(0, queue.shift()!);
    if (count === 0) {
      const day = queue.shift()!;
      addFieldRow({
        path: arrayPath,
        schemaPath: arrayPath,
        subFieldState: {
          day: { initialValue: String(day), value: String(day), valid: true },
          open: { initialValue: open, value: open, valid: true },
          close: { initialValue: close, value: close, valid: true },
        },
      });
      count = 1;
      await loaded();
      fill(0, day);
    }
    for (const day of queue) {
      dispatchFields({ type: 'DUPLICATE_ROW', path: arrayPath, rowIndex: count - 1 });
      fill(count, day);
      count++;
    }
    setModified(true);
    setBusy(false);
    setMessage(say(T.done));
  }

  return (
    <details className="gg-bulk">
      <summary>
        <CalendarRange aria-hidden />
        {say(T.title)}
      </summary>
      <div className="gg-bulk__body">
        <div className="gg-bulk__days" role="group" aria-label={say(T.days)}>
          {WEEK.map((day) => (
            <label key={day} className="gg-bulk__day" data-on={days.includes(day) || undefined}>
              <input type="checkbox" checked={days.includes(day)} onChange={() => toggle(day)} />
              {say(WEEKDAYS[day].label)}
            </label>
          ))}
          <button type="button" className="gg-bulk__quick" onClick={() => setDays([1, 2, 3, 4, 5])}>
            {say(T.weekdays)}
          </button>
        </div>
        <div className="gg-bulk__times">
          <label>
            {say(T.from)}
            <select value={open} onChange={(e) => setOpen(e.target.value)}>
              {QUARTER_HOURS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
          <label>
            {say(T.to)}
            <select value={close} onChange={(e) => setClose(e.target.value)}>
              {QUARTER_HOURS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="gg-bulk__replace">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          {say(T.replace)}
        </label>
        <div className="gg-bulk__actions">
          <button type="button" className="gg-btn gg-btn--primary" disabled={busy} onClick={() => void apply()}>
            {say(T.apply)}
          </button>
          {message && <span role="status">{message}</span>}
        </div>
      </div>
    </details>
  );
}
