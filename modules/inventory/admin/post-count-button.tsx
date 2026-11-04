'use client';

import { toast, useDocumentInfo, useFormFields, useFormModified, useTranslation } from '@payloadcms/ui';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { postStockCount } from '../actions';

// "Post this count" on an open stock count (ui field `postPanel`). Posting writes the variances and locks the count,
// so the page reloads to show it read-only with the expected quantities filled in.

const TEXT = {
  fr: {
    post: 'Valider l’inventaire',
    explain: 'Le stock de chaque article prend la quantité comptée. L’inventaire ne pourra plus être modifié.',
    saveFirst: 'Enregistrez d’abord vos changements.',
    confirm: 'Valider cet inventaire ? Le stock sera remplacé par les quantités comptées.',
    done: 'Inventaire validé.',
    posted: 'Inventaire validé : il ne peut plus être modifié.',
    error: 'Impossible de valider. Vérifiez qu’un article n’apparaît pas deux fois.',
  },
  en: {
    post: 'Post this count',
    explain: 'Each item’s stock becomes the counted quantity. The count can no longer be changed afterwards.',
    saveFirst: 'Save your changes first.',
    confirm: 'Post this count? Stock will be replaced by the counted quantities.',
    done: 'Count posted.',
    posted: 'Count posted: it can no longer be changed.',
    error: 'Could not post. Check that no item appears twice.',
  },
  de: {
    post: 'Inventur buchen',
    explain: 'Der Bestand jedes Artikels wird zur gezählten Menge. Danach ist die Inventur nicht mehr änderbar.',
    saveFirst: 'Speichern Sie zuerst Ihre Änderungen.',
    confirm: 'Diese Inventur buchen? Der Bestand wird durch die gezählten Mengen ersetzt.',
    done: 'Inventur gebucht.',
    posted: 'Inventur gebucht: sie kann nicht mehr geändert werden.',
    error: 'Buchen nicht möglich. Prüfen Sie, dass kein Artikel doppelt vorkommt.',
  },
  pt: {
    post: 'Validar inventário',
    explain: 'O stock de cada artigo passa a ser a quantidade contada. Depois o inventário já não pode ser alterado.',
    saveFirst: 'Guarde primeiro as suas alterações.',
    confirm: 'Validar este inventário? O stock será substituído pelas quantidades contadas.',
    done: 'Inventário validado.',
    posted: 'Inventário validado: já não pode ser alterado.',
    error: 'Não foi possível validar. Verifique que nenhum artigo aparece duas vezes.',
  },
};

export default function PostCountButton() {
  const { i18n } = useTranslation();
  const t = TEXT[(i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT];
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const modified = useFormModified();
  const [busy, setBusy] = useState(false);
  if (!id) return null;
  if (status === 'posted') return <p className="gg-stock__hint gg-stock__done">{t.posted}</p>;

  async function post() {
    if (!window.confirm(t.confirm)) return;
    setBusy(true);
    const res = await postStockCount(null, { count: String(id) });
    if (!res.ok) {
      setBusy(false);
      toast.error(t.error);
      return;
    }
    toast.success(t.done);
    window.location.reload();
  }

  return (
    <div className="gg-stock gg-stock--count">
      <p className="gg-stock__hint">{modified ? t.saveFirst : t.explain}</p>
      <button type="button" className="gg-btn gg-btn--primary" disabled={busy || modified} onClick={post}>
        <ClipboardCheck />
        <span>{t.post}</span>
      </button>
    </div>
  );
}
