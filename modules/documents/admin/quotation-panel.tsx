import type { UIFieldServerProps } from 'payload';
import type { ReactNode } from 'react';
import DecisionBar, { type Decision, type DecisionText } from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { linkToken } from '@/lib/link-token';
import { formatMoney } from '@/lib/money';
import { quotationUrl } from '../mail';
import { copyQuotationAction, declineQuotationByStaff, resendQuotationAction, sendQuotationAction } from '../actions';
import { QUOTATION_STATUS, QUOTATION_TONES, type QuotationStatus } from '../collections';

// The top of a quotation's page (ui field `panel`): where it stands, the next step, the amounts, the customer and the
// event, what happened (sent, viewed, signed…), the PDFs. A draft is edited in the fields below and saved; once sent,
// the quotation is read-only and only these steps remain.

const TEXT = {
  fr: {
    draftNote: 'Brouillon : complétez les lignes, la remise et les conditions ci-dessous, puis enregistrez. Les totaux se recalculent à chaque enregistrement.',
    send: { label: 'Envoyer au client', hint: (email: string) => `un numéro DEV est attribué, le PDF est créé et envoyé à ${email} avec un lien pour le signer. Ensuite le devis ne se modifie plus.` },
    preview: 'Aperçu du PDF',
    resend: { label: 'Renvoyer l’e-mail', hint: (email: string) => `le même devis et son PDF sont renvoyés à ${email}.` },
    copy: { label: 'Nouvelle version', hint: 'un brouillon est créé avec les mêmes lignes ; une fois envoyé, il remplace celui-ci.' },
    decline: { label: 'Refusé par le client', hint: 'à utiliser quand le client refuse par téléphone ou par e-mail ; la demande passe en « Refusée ».' },
    amounts: 'Montants',
    subtotal: 'Sous-total',
    discount: 'Remise',
    total: 'Total TTC',
    vat: (rate: string) => `dont TVA ${rate} %`,
    customer: 'Client',
    event: 'Prestation',
    request: 'Demande',
    language: 'Langue',
    validUntil: 'Valable jusqu’au',
    follow: 'Suivi',
    sentAt: 'Envoyé le',
    viewedAt: 'Consulté le',
    acceptedAt: 'Signé le',
    signedBy: 'Signé par',
    ip: 'Adresse IP',
    declinedAt: 'Refusé le',
    reason: 'Raison',
    expiredAt: 'Expiré le',
    files: 'Documents',
    sentPdf: 'Devis envoyé (PDF)',
    signedPdf: 'Devis signé (PDF)',
    link: 'Lien du client',
    nothing: 'Rien d’autre à faire sur ce devis.',
  },
  en: {
    draftNote: 'Draft: complete the lines, discount and conditions below, then save. Totals are worked out again on each save.',
    send: { label: 'Send to the customer', hint: (email: string) => `a DEV number is given, the PDF is made and sent to ${email} with a link to sign it. After that the quotation cannot be changed.` },
    preview: 'Preview the PDF',
    resend: { label: 'Send the e-mail again', hint: (email: string) => `the same quotation and its PDF are sent again to ${email}.` },
    copy: { label: 'New version', hint: 'a draft is made with the same lines; once sent, it replaces this one.' },
    decline: { label: 'Declined by the customer', hint: 'when the customer declines by phone or e-mail; the request becomes “Declined”.' },
    amounts: 'Amounts',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total incl. VAT',
    vat: (rate: string) => `incl. VAT ${rate} %`,
    customer: 'Customer',
    event: 'Event',
    request: 'Request',
    language: 'Language',
    validUntil: 'Valid until',
    follow: 'Follow-up',
    sentAt: 'Sent on',
    viewedAt: 'Viewed on',
    acceptedAt: 'Signed on',
    signedBy: 'Signed by',
    ip: 'IP address',
    declinedAt: 'Declined on',
    reason: 'Reason',
    expiredAt: 'Expired on',
    files: 'Documents',
    sentPdf: 'Quotation sent (PDF)',
    signedPdf: 'Signed quotation (PDF)',
    link: 'Customer’s link',
    nothing: 'Nothing else to do on this quotation.',
  },
  de: {
    draftNote: 'Entwurf: Zeilen, Rabatt und Bedingungen unten ausfüllen, dann speichern. Die Summen werden bei jedem Speichern neu berechnet.',
    send: { label: 'An den Kunden senden', hint: (email: string) => `eine DEV-Nummer wird vergeben, das PDF erstellt und mit einem Link zum Unterschreiben an ${email} gesendet. Danach ist das Angebot nicht mehr änderbar.` },
    preview: 'PDF-Vorschau',
    resend: { label: 'E-Mail erneut senden', hint: (email: string) => `dasselbe Angebot mit PDF wird erneut an ${email} gesendet.` },
    copy: { label: 'Neue Version', hint: 'ein Entwurf mit denselben Zeilen wird erstellt; einmal gesendet, ersetzt er dieses Angebot.' },
    decline: { label: 'Vom Kunden abgelehnt', hint: 'wenn der Kunde telefonisch oder per E-Mail ablehnt; die Anfrage wird „Abgelehnt“.' },
    amounts: 'Beträge',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    total: 'Summe inkl. MwSt.',
    vat: (rate: string) => `inkl. MwSt. ${rate} %`,
    customer: 'Kunde',
    event: 'Veranstaltung',
    request: 'Anfrage',
    language: 'Sprache',
    validUntil: 'Gültig bis',
    follow: 'Verlauf',
    sentAt: 'Gesendet am',
    viewedAt: 'Angesehen am',
    acceptedAt: 'Unterschrieben am',
    signedBy: 'Unterschrieben von',
    ip: 'IP-Adresse',
    declinedAt: 'Abgelehnt am',
    reason: 'Grund',
    expiredAt: 'Abgelaufen am',
    files: 'Dokumente',
    sentPdf: 'Gesendetes Angebot (PDF)',
    signedPdf: 'Unterschriebenes Angebot (PDF)',
    link: 'Link des Kunden',
    nothing: 'Bei diesem Angebot ist nichts mehr zu tun.',
  },
  pt: {
    draftNote: 'Rascunho: complete as linhas, o desconto e as condições abaixo e grave. Os totais são recalculados a cada gravação.',
    send: { label: 'Enviar ao cliente', hint: (email: string) => `é atribuído um número DEV, o PDF é criado e enviado para ${email} com uma ligação para assinar. Depois o orçamento já não se altera.` },
    preview: 'Pré-visualizar o PDF',
    resend: { label: 'Reenviar o e-mail', hint: (email: string) => `o mesmo orçamento e o seu PDF são reenviados para ${email}.` },
    copy: { label: 'Nova versão', hint: 'é criado um rascunho com as mesmas linhas; uma vez enviado, substitui este.' },
    decline: { label: 'Recusado pelo cliente', hint: 'quando o cliente recusa por telefone ou e-mail; o pedido passa a «Recusado».' },
    amounts: 'Montantes',
    subtotal: 'Subtotal',
    discount: 'Desconto',
    total: 'Total c/ IVA',
    vat: (rate: string) => `inclui IVA ${rate} %`,
    customer: 'Cliente',
    event: 'Evento',
    request: 'Pedido',
    language: 'Língua',
    validUntil: 'Válido até',
    follow: 'Seguimento',
    sentAt: 'Enviado em',
    viewedAt: 'Visto em',
    acceptedAt: 'Assinado em',
    signedBy: 'Assinado por',
    ip: 'Endereço IP',
    declinedAt: 'Recusado em',
    reason: 'Motivo',
    expiredAt: 'Expirado em',
    files: 'Documentos',
    sentPdf: 'Orçamento enviado (PDF)',
    signedPdf: 'Orçamento assinado (PDF)',
    link: 'Ligação do cliente',
    nothing: 'Nada mais a fazer neste orçamento.',
  },
};

const DECIDE: Record<keyof typeof TEXT, DecisionText> = {
  fr: { confirm: 'Confirmer', back: 'Retour', reason: 'Raison', reasonMandatory: 'Raison (obligatoire, gardée dans l’historique)', reasonPh: 'Budget, autre prestataire, date annulée…', done: 'Enregistré.', error: 'Impossible d’enregistrer. Réessayez.', errors: { notDraft: 'Ce devis a déjà été envoyé : la page se rafraîchit.', notAcceptable: 'Ce devis a changé entre-temps : la page se rafraîchit.', emptyQuotation: 'Ajoutez au moins une ligne avec un prix, puis enregistrez.', email: 'Il manque l’e-mail du client.', reasonRequired: 'Donnez une raison (3 caractères au moins).' } },
  en: { confirm: 'Confirm', back: 'Back', reason: 'Reason', reasonMandatory: 'Reason (required, kept in the history)', reasonPh: 'Budget, another caterer, date cancelled…', done: 'Saved.', error: 'Could not save. Please try again.', errors: { notDraft: 'This quotation was already sent: the page refreshes.', notAcceptable: 'This quotation changed meanwhile: the page refreshes.', emptyQuotation: 'Add at least one line with a price, then save.', email: 'The customer’s e-mail is missing.', reasonRequired: 'Give a reason (at least 3 characters).' } },
  de: { confirm: 'Bestätigen', back: 'Zurück', reason: 'Grund', reasonMandatory: 'Grund (Pflicht, im Verlauf gespeichert)', reasonPh: 'Budget, anderer Anbieter, Termin abgesagt…', done: 'Gespeichert.', error: 'Speichern nicht möglich.', errors: { notDraft: 'Dieses Angebot wurde schon gesendet: die Seite wird neu geladen.', notAcceptable: 'Dieses Angebot hat sich geändert: die Seite wird neu geladen.', emptyQuotation: 'Fügen Sie mindestens eine Zeile mit Preis hinzu und speichern Sie.', email: 'Die E-Mail des Kunden fehlt.', reasonRequired: 'Geben Sie einen Grund an (mindestens 3 Zeichen).' } },
  pt: { confirm: 'Confirmar', back: 'Voltar', reason: 'Motivo', reasonMandatory: 'Motivo (obrigatório, guardado no histórico)', reasonPh: 'Orçamento, outro fornecedor, data cancelada…', done: 'Guardado.', error: 'Não foi possível guardar.', errors: { notDraft: 'Este orçamento já foi enviado: a página vai atualizar.', notAcceptable: 'Este orçamento mudou entretanto: a página vai atualizar.', emptyQuotation: 'Junte pelo menos uma linha com preço e grave.', email: 'Falta o e-mail do cliente.', reasonRequired: 'Indique um motivo (pelo menos 3 caracteres).' } },
};

export default async function QuotationPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const q = await payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!q) return null;
  const lang = (i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT;
  const t = TEXT[lang];
  const status = (q.status ?? 'draft') as QuotationStatus;
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, lang);
  const when = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' }).format(new Date(v)) : null);
  const day = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(v)) : '—');
  const email = q.contact?.email ?? '';
  const request = q.cateringRequest
    ? await payload.findByID({ collection: 'cateringRequests', id: String(q.cateringRequest), depth: 0, overrideAccess: true, disableErrors: true, select: { number: true } })
    : null;
  const fileLink = (fileId: unknown) => {
    const fid = typeof fileId === 'object' && fileId ? (fileId as { id: string }).id : String(fileId);
    return `/api/documents/${fid}?t=${linkToken('document', fid)}`;
  };

  const sales = hasRole(user, ['sales']);
  const decisions: Decision[] = !sales
    ? []
    : status === 'draft'
      ? [{ to: 'send', ...t.send, hint: t.send.hint(email), tone: 'primary', action: sendQuotationAction }]
      : status === 'sent' || status === 'viewed'
        ? [
            { to: 'resend', ...t.resend, hint: t.resend.hint(email), action: resendQuotationAction },
            { to: 'copy', ...t.copy, action: copyQuotationAction },
            { to: 'decline', ...t.decline, tone: 'danger', reason: 'required', action: declineQuotationByStaff },
          ]
        : status === 'declined' || status === 'expired'
          ? [{ to: 'copy', ...t.copy, action: copyQuotationAction }]
          : [];

  const totals = q.totals;
  const rate = (bp: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(bp / 100);
  const follow: [string, string][] = [
    [t.sentAt, when(q.sentAt)],
    [t.viewedAt, when(q.viewedAt)],
    [t.acceptedAt, when(q.acceptedAt)],
    [t.signedBy, q.signature?.name ?? null],
    [t.ip, q.signature?.ip ?? null],
    [t.declinedAt, when(q.declinedAt)],
    [t.reason, q.declineReason ?? null],
    [t.expiredAt, when(q.expiredAt)],
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <DocPanel>
      <DocHead
        badge={<span className={`gg-badge gg-badge--${QUOTATION_TONES[status]}`}>{QUOTATION_STATUS[status][lang]}</span>}
        title={q.title ?? q.number ?? '—'}
        sub={`${money(totals?.totalCents)} · ${t.validUntil} ${day(q.validUntil)}`}
      >
        {status === 'draft' && <p className="gg-doc__muted">{t.draftNote}</p>}
        {decisions.length > 0 ? <DecisionBar action={sendQuotationAction} target={{ quotation: q.id }} decisions={decisions} text={DECIDE[lang]} /> : <p className="gg-doc__muted">{t.nothing}</p>}
        {status === 'draft' && (
          <a className="gg-btn" href={`/api/documents/preview/${q.id}`} target="_blank" rel="noopener noreferrer">
            {t.preview}
          </a>
        )}
      </DocHead>
      <DocGrid>
        <DocCard title={t.amounts}>
          <DocFacts
            rows={[
              ...(totals?.discountCents ? ([[t.subtotal, money(totals.subtotalCents)], [t.discount, `− ${money(totals.discountCents)}`]] as [string, string][]) : []),
              [t.total, <b key="total">{money(totals?.totalCents)}</b>],
              ...(totals?.vatBreakdown ?? []).map((v) => [t.vat(rate(v.rateBp ?? 0)), money(v.vatCents)] as [string, string]),
            ]}
          />
        </DocCard>
        <DocCard title={t.customer}>
          <DocFacts
            rows={[
              [t.customer, q.contact?.name],
              ['E-mail', email ? <a href={`mailto:${email}`}>{email}</a> : '—'],
              [t.event, [day(q.event?.date), q.event?.time, q.event?.guests && `${q.event.guests} pers.`, q.event?.location].filter(Boolean).join(' · ')],
              [t.request, request ? <a href={`/admin/collections/cateringRequests/${request.id}`}>{request.number}</a> : '—'],
              [t.language, LOCALE_NAMES[(q.locale ?? 'fr') as Locale]],
            ]}
          />
        </DocCard>
        {follow.length > 0 && (
          <DocCard title={t.follow}>
            <DocFacts rows={follow} />
          </DocCard>
        )}
        {(q.pdf || q.signedPdf) && (
          <DocCard title={t.files}>
            <DocFacts
              rows={[
                ...(q.pdf ? ([[t.sentPdf, <a key="pdf" href={fileLink(q.pdf)} target="_blank" rel="noopener noreferrer">{`${q.number}.pdf`}</a>]] as [string, ReactNode][]) : []),
                ...(q.signedPdf ? ([[t.signedPdf, <a key="signed" href={fileLink(q.signedPdf)} target="_blank" rel="noopener noreferrer">{`${q.number}-signe.pdf`}</a>]] as [string, ReactNode][]) : []),
                ...(status === 'sent' || status === 'viewed' ? ([[t.link, <a key="link" href={quotationUrl(q)} target="_blank" rel="noopener noreferrer">{quotationUrl(q).replace(/\?.*$/, '')}</a>]] as [string, ReactNode][]) : []),
              ]}
            />
          </DocCard>
        )}
      </DocGrid>
    </DocPanel>
  );
}
