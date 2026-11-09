'use client';

import { ConfirmationModal, toast, useDocumentInfo, useFormFields, useFormModified, useModal, useTranslation } from '@payloadcms/ui';
import { CircleCheck, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { postStockCount } from '../actions';

// "Post this count" on an open stock count (ui field `postPanel`). Posting writes the variances and locks the count,
// so the page reloads to show it read-only with the expected quantities filled in. It asks first in Payload's own
// confirmation dialog (the one its deletes use), never the browser's (APPLUX report 2, §10).

const MODAL = 'gg-post-count';

const TEXT = {
  fr: {
    post: 'Valider l’inventaire',
    explain: 'Le stock de chaque article prend la quantité comptée. L’inventaire ne pourra plus être modifié.',
    saveFirst: 'Enregistrez d’abord vos changements.',
    done: 'Inventaire validé.',
    title: 'Prêt à valider ?',
    posted: 'Inventaire validé',
    postedOn: (d: string) => `Le ${d}. Le stock a pris les quantités comptées ; l’inventaire ne peut plus être modifié.`,
    error: 'Impossible de valider. Vérifiez qu’un article n’apparaît pas deux fois.',
  },
  en: {
    post: 'Post this count',
    explain: 'Each item’s stock becomes the counted quantity. The count can no longer be changed afterwards.',
    saveFirst: 'Save your changes first.',
    done: 'Count posted.',
    title: 'Ready to post?',
    posted: 'Count posted',
    postedOn: (d: string) => `On ${d}. Stock now matches the counted quantities; the count can no longer be changed.`,
    error: 'Could not post. Check that no item appears twice.',
  },
  de: {
    post: 'Inventur buchen',
    explain: 'Der Bestand jedes Artikels wird zur gezählten Menge. Danach ist die Inventur nicht mehr änderbar.',
    saveFirst: 'Speichern Sie zuerst Ihre Änderungen.',
    done: 'Inventur gebucht.',
    title: 'Bereit zum Buchen?',
    posted: 'Inventur gebucht',
    postedOn: (d: string) => `Am ${d}. Der Bestand entspricht den gezählten Mengen; die Inventur ist nicht mehr änderbar.`,
    error: 'Buchen nicht möglich. Prüfen Sie, dass kein Artikel doppelt vorkommt.',
  },
  pt: {
    post: 'Validar inventário',
    explain: 'O stock de cada artigo passa a ser a quantidade contada. Depois o inventário já não pode ser alterado.',
    saveFirst: 'Guarde primeiro as suas alterações.',
    done: 'Inventário validado.',
    title: 'Pronto para validar?',
    posted: 'Inventário validado',
    postedOn: (d: string) => `Em ${d}. O stock passou a ser o contado; o inventário já não pode ser alterado.`,
    error: 'Não foi possível validar. Verifique que nenhum artigo aparece duas vezes.',
  },
};

export default function PostCountButton() {
  const { i18n } = useTranslation();
  const t = TEXT[(i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT];
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const postedAt = useFormFields(([fields]) => fields.postedAt?.value) as string | undefined;
  const modified = useFormModified();
  const [busy, setBusy] = useState(false);
  const { openModal } = useModal();
  if (!id) return null;
  if (status === 'posted') {
    const when = postedAt
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Luxembourg' }).format(new Date(postedAt))
      : '';
    return (
      <div className="gg-callout gg-callout--success">
        <CircleCheck />
        <div>
          <b>{t.posted}</b>
          <p>{t.postedOn(when)}</p>
        </div>
      </div>
    );
  }

  async function post() {
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
    <div className="gg-callout">
      <ClipboardCheck />
      <div>
        <b>{t.title}</b>
        <p>{modified ? t.saveFirst : t.explain}</p>
      </div>
      <button type="button" className="gg-btn gg-btn--primary" disabled={busy || modified} onClick={() => openModal(MODAL)}>
        {t.post}
      </button>
      <ConfirmationModal modalSlug={MODAL} heading={t.title} body={t.explain} confirmLabel={t.post} onConfirm={post} />
    </div>
  );
}
