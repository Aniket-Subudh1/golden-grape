'use client';

import { ConfirmationModal, toast, useDocumentInfo, useFormFields, useModal, useTranslation } from '@payloadcms/ui';
import { Download, Pencil } from 'lucide-react';
import { useState } from 'react';
import { saveFile } from '@/components/admin/save-file';
import { correctShiftAction, exportAttendance } from '../actions';

// A shift's "Correct" button (admin edit view) and the monthly CSV button (report view). The correction asks which
// time, the right time (Luxembourg) and a reason; the service writes the shift, the correction row and the audit.

const MODAL = 'gg-correct-shift';

const TEXT = {
  fr: { correct: 'Corriger', title: 'Corriger ce pointage', field: 'Heure à corriger', checkIn: 'Arrivée', checkOut: 'Départ', at: 'Heure correcte', reason: 'Raison (obligatoire)', done: 'Correction enregistrée.', export: 'Exporter en CSV', errors: { outBeforeIn: 'Le départ doit venir après l’arrivée.', shiftTooLong: 'Un service ne peut pas dépasser 24 heures.', timeInFuture: 'L’heure ne peut pas être dans le futur.', reasonRequired: 'Indiquez une raison (3 caractères au moins).' }, error: 'Correction impossible. Rechargez la page et réessayez.' },
  en: { correct: 'Correct', title: 'Correct this shift', field: 'Time to correct', checkIn: 'Check-in', checkOut: 'Check-out', at: 'Correct time', reason: 'Reason (required)', done: 'Correction saved.', export: 'Export CSV', errors: { outBeforeIn: 'The check-out must come after the check-in.', shiftTooLong: 'A shift cannot last more than 24 hours.', timeInFuture: 'The time cannot be in the future.', reasonRequired: 'Give a reason (at least 3 characters).' }, error: 'Could not correct. Reload the page and try again.' },
  de: { correct: 'Korrigieren', title: 'Diese Schicht korrigieren', field: 'Zu korrigierende Zeit', checkIn: 'Kommen', checkOut: 'Gehen', at: 'Richtige Zeit', reason: 'Grund (Pflicht)', done: 'Korrektur gespeichert.', export: 'CSV exportieren', errors: { outBeforeIn: 'Gehen muss nach Kommen liegen.', shiftTooLong: 'Eine Schicht darf nicht länger als 24 Stunden sein.', timeInFuture: 'Die Zeit darf nicht in der Zukunft liegen.', reasonRequired: 'Bitte einen Grund angeben (mindestens 3 Zeichen).' }, error: 'Korrektur nicht möglich. Seite neu laden und erneut versuchen.' },
  pt: { correct: 'Corrigir', title: 'Corrigir este turno', field: 'Hora a corrigir', checkIn: 'Entrada', checkOut: 'Saída', at: 'Hora correta', reason: 'Motivo (obrigatório)', done: 'Correção guardada.', export: 'Exportar CSV', errors: { outBeforeIn: 'A saída tem de ser depois da entrada.', shiftTooLong: 'Um turno não pode passar de 24 horas.', timeInFuture: 'A hora não pode estar no futuro.', reasonRequired: 'Indique um motivo (pelo menos 3 caracteres).' }, error: 'Não foi possível corrigir. Recarregue a página e tente de novo.' },
};

const useText = () => {
  const { i18n } = useTranslation();
  return TEXT[(i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT];
};
const local = (iso: unknown) => (typeof iso === 'string' && iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Luxembourg' }).slice(0, 16).replace(' ', 'T') : '');

export function CorrectButton() {
  const t = useText();
  const { id } = useDocumentInfo();
  const checkIn = useFormFields(([f]) => f.checkIn?.value);
  const checkOut = useFormFields(([f]) => f.checkOut?.value);
  const { openModal } = useModal();
  const [field, setField] = useState<'checkIn' | 'checkOut'>(checkOut ? 'checkIn' : 'checkOut');
  const [at, setAt] = useState('');
  const [reason, setReason] = useState('');
  if (!id) return null;

  async function save() {
    const res = await correctShiftAction(null, { shift: String(id), field, at: at || local(field === 'checkIn' ? checkIn : (checkOut ?? checkIn)), reason });
    if (!res.ok) {
      const key = res.message ?? Object.values(res.fieldErrors ?? {})[0]?.[0] ?? '';
      toast.error((t.errors as Record<string, string>)[key] ?? t.error);
      return;
    }
    toast.success(t.done);
    window.location.reload();
  }

  return (
    <div className="gg-actions">
      <button type="button" className="gg-btn gg-btn--primary" onClick={() => openModal(MODAL)}>
        <Pencil />
        <span>{t.correct}</span>
      </button>
      <ConfirmationModal
        modalSlug={MODAL}
        heading={t.title}
        confirmLabel={t.correct}
        onConfirm={save}
        body={
          <div style={{ display: 'grid', gap: 14 }}>
            <label className="gg-io__date" style={{ display: 'grid', gap: 6 }}>
              <span>{t.field}</span>
              <select value={field} onChange={(e) => { setField(e.target.value as 'checkIn' | 'checkOut'); setAt(''); }}>
                <option value="checkIn">{t.checkIn}</option>
                <option value="checkOut">{t.checkOut}</option>
              </select>
            </label>
            <label className="gg-io__date" style={{ display: 'grid', gap: 6 }}>
              <span>{t.at}</span>
              <input type="datetime-local" value={at || local(field === 'checkIn' ? checkIn : (checkOut ?? checkIn))} onChange={(e) => setAt(e.target.value)} />
            </label>
            <label className="gg-io__date" style={{ display: 'grid', gap: 6 }}>
              <span>{t.reason}</span>
              <input type="text" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
        }
      />
    </div>
  );
}

export function ExportButton({ month }: { month: string }) {
  const t = useText();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="gg-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await exportAttendance(null, { month });
        setBusy(false);
        if (!res.ok) return void toast.error(t.error);
        saveFile(res.data.name, res.data.csv);
      }}
    >
      <Download />
      <span>{t.export}</span>
    </button>
  );
}
