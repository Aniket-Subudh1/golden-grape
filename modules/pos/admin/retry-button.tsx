'use client';

import { toast, useDocumentInfo, useFormFields, useTranslation } from '@payloadcms/ui';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import { retryOutboxAction } from '../actions';

// "Retry now" on a failed or given-up message to the till (outbox edit view): due at once for the next job run.
const TEXT = {
  fr: { retry: 'Relancer', done: 'Relancé : envoyé au prochain passage (chaque minute).', error: 'Impossible de relancer.' },
  en: { retry: 'Retry now', done: 'Queued again: sent on the next run (every minute).', error: 'Could not retry.' },
  de: { retry: 'Jetzt erneut senden', done: 'Wieder eingeplant: wird beim nächsten Lauf gesendet (jede Minute).', error: 'Erneutes Senden nicht möglich.' },
  pt: { retry: 'Repetir agora', done: 'Em fila de novo: enviado na próxima passagem (a cada minuto).', error: 'Não foi possível repetir.' },
};

export function RetryButton() {
  const { i18n } = useTranslation();
  const t = TEXT[(i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT];
  const { id } = useDocumentInfo();
  const status = useFormFields(([f]) => f.status?.value);
  const [busy, setBusy] = useState(false);
  if (!id || (status !== 'failed' && status !== 'dead')) return null;
  return (
    <div className="gg-actions">
      <button
        type="button"
        className="gg-btn gg-btn--primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await retryOutboxAction(null, { id: String(id) });
          if (!res.ok) {
            setBusy(false);
            return void toast.error(t.error);
          }
          toast.success(t.done);
          window.location.reload();
        }}
      >
        <RotateCw />
        <span>{t.retry}</span>
      </button>
    </div>
  );
}

const CONTINUE = { fr: 'Continuer l’import', en: 'Continue the import', de: 'Import fortsetzen', pt: 'Continuar a importação' };

/** On a till import not finished (codes still without an item): back to it on the Import / Export page. */
export function ContinueImport() {
  const { i18n } = useTranslation();
  const { id } = useDocumentInfo();
  const status = useFormFields(([f]) => f.status?.value);
  if (!id || status === 'posted') return null;
  return (
    <div className="gg-actions">
      <a className="gg-btn gg-btn--primary" href={`/admin/import-export?posImport=${id}`}>
        <RotateCw />
        <span>{CONTINUE[(i18n.language in CONTINUE ? i18n.language : 'fr') as keyof typeof CONTINUE]}</span>
      </a>
    </div>
  );
}
