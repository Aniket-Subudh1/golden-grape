'use client';

import { ConfirmationModal, toast, useDocumentInfo, useFormFields, useModal, useTranslation } from '@payloadcms/ui';
import { Download, FileMinus, FileText, HandCoins } from 'lucide-react';
import { useState } from 'react';
import { saveFile } from '@/components/admin/save-file';
import { today } from '@/lib/time';
import { creditNoteAction, exportDocumentsAction, markInvoicePaidAction } from '../actions';

// An invoice's own buttons (admin edit view, `beforeDocumentControls`): its PDF, "Mark paid" for an invoice paid by
// transfer, and a credit note for what is left on it, with the reason the law asks for. An issued invoice never
// changes otherwise. The invoices list carries the accountant's export.

const PAID = 'gg-invoice-paid';
const CREDIT = 'gg-invoice-credit';

const TEXT = {
  fr: {
    pdf: 'PDF',
    paid: 'Marquer payée',
    paidTitle: 'Facture payée ?',
    paidBody: 'Le paiement est enregistré sur la commande, à la date du jour.',
    paidDone: 'Facture marquée payée.',
    credit: 'Faire un avoir',
    creditTitle: 'Avoir sur cette facture',
    creditBody: 'Un avoir numéroté annule ce qui reste de la facture et part au client par e-mail. Raison :',
    creditDone: (n: string) => `Avoir ${n} émis.`,
    reason: 'Au moins 3 caractères.',
    error: 'Opération impossible. Rechargez la page et réessayez.',
    exportTitle: 'Export pour la comptabilité',
    exportIntro: 'Factures et avoirs émis sur la période : hors TVA et TVA par taux, avoirs en négatif.',
    from: 'Du',
    to: 'Au',
    exportButton: 'Exporter (CSV)',
    none: 'Aucune facture ni avoir sur cette période.',
  },
  en: {
    pdf: 'PDF',
    paid: 'Mark paid',
    paidTitle: 'Invoice paid?',
    paidBody: 'The payment is recorded on the order, dated today.',
    paidDone: 'Invoice marked paid.',
    credit: 'Credit note',
    creditTitle: 'Credit note for this invoice',
    creditBody: 'A numbered credit note cancels what is left of the invoice and is e-mailed to the customer. Reason:',
    creditDone: (n: string) => `Credit note ${n} issued.`,
    reason: 'At least 3 characters.',
    error: 'Could not do that. Reload the page and try again.',
    exportTitle: 'Accounting export',
    exportIntro: 'Invoices and credit notes issued in the period: net and VAT per rate, credit notes negative.',
    from: 'From',
    to: 'To',
    exportButton: 'Export (CSV)',
    none: 'No invoice or credit note in this period.',
  },
  de: {
    pdf: 'PDF',
    paid: 'Als bezahlt markieren',
    paidTitle: 'Rechnung bezahlt?',
    paidBody: 'Die Zahlung wird mit heutigem Datum bei der Bestellung erfasst.',
    paidDone: 'Rechnung als bezahlt markiert.',
    credit: 'Gutschrift',
    creditTitle: 'Gutschrift zu dieser Rechnung',
    creditBody: 'Eine nummerierte Gutschrift storniert den offenen Rest der Rechnung und geht per E-Mail an den Kunden. Grund:',
    creditDone: (n: string) => `Gutschrift ${n} ausgestellt.`,
    reason: 'Mindestens 3 Zeichen.',
    error: 'Das ging nicht. Seite neu laden und erneut versuchen.',
    exportTitle: 'Export für die Buchhaltung',
    exportIntro: 'Im Zeitraum ausgestellte Rechnungen und Gutschriften: netto und MwSt. je Satz, Gutschriften negativ.',
    from: 'Von',
    to: 'Bis',
    exportButton: 'Exportieren (CSV)',
    none: 'Keine Rechnung oder Gutschrift in diesem Zeitraum.',
  },
  pt: {
    pdf: 'PDF',
    paid: 'Marcar paga',
    paidTitle: 'Fatura paga?',
    paidBody: 'O pagamento fica registado na encomenda, com a data de hoje.',
    paidDone: 'Fatura marcada como paga.',
    credit: 'Nota de crédito',
    creditTitle: 'Nota de crédito desta fatura',
    creditBody: 'Uma nota de crédito numerada anula o que resta da fatura e é enviada ao cliente por e-mail. Motivo:',
    creditDone: (n: string) => `Nota de crédito ${n} emitida.`,
    reason: 'Pelo menos 3 caracteres.',
    error: 'Não foi possível. Recarregue a página e tente de novo.',
    exportTitle: 'Exportação para a contabilidade',
    exportIntro: 'Faturas e notas de crédito emitidas no período: sem IVA e IVA por taxa, notas de crédito em negativo.',
    from: 'De',
    to: 'Até',
    exportButton: 'Exportar (CSV)',
    none: 'Nenhuma fatura ou nota de crédito neste período.',
  },
};

const useText = () => {
  const { i18n } = useTranslation();
  return TEXT[(i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT];
};
const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as { id: string }).id) : v ? String(v) : '');

export function InvoiceActions() {
  const t = useText();
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value) as string | undefined;
  const pdf = idOf(useFormFields(([fields]) => fields.pdf?.value));
  const { openModal } = useModal();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!id) return null;

  async function markPaid() {
    setBusy(true);
    const res = await markInvoicePaidAction(null, { invoice: String(id) });
    if (!res.ok) {
      setBusy(false);
      toast.error(t.error);
      return;
    }
    toast.success(t.paidDone);
    window.location.reload();
  }

  async function credit() {
    if (reason.trim().length < 3) {
      toast.error(t.reason);
      return;
    }
    setBusy(true);
    const res = await creditNoteAction(null, { invoice: String(id), reason });
    if (!res.ok) {
      setBusy(false);
      toast.error(t.error);
      return;
    }
    toast.success(t.creditDone(res.data.number));
    window.location.reload();
  }

  return (
    <div className="gg-actions">
      {pdf && (
        <a className="gg-btn" href={`/api/documents/${pdf}`} target="_blank" rel="noreferrer">
          <FileText />
          <span>{t.pdf}</span>
        </a>
      )}
      {status === 'issued' && (
        <button type="button" className="gg-btn gg-btn--primary" disabled={busy} onClick={() => openModal(PAID)}>
          <HandCoins />
          <span>{t.paid}</span>
        </button>
      )}
      {status !== 'credited' && (
        <button type="button" className="gg-btn" disabled={busy} onClick={() => openModal(CREDIT)}>
          <FileMinus />
          <span>{t.credit}</span>
        </button>
      )}
      <ConfirmationModal modalSlug={PAID} heading={t.paidTitle} body={t.paidBody} confirmLabel={t.paid} onConfirm={markPaid} />
      <ConfirmationModal
        modalSlug={CREDIT}
        heading={t.creditTitle}
        body={
          <label className="gg-io__date" style={{ display: 'grid', gap: 8 }}>
            <span>{t.creditBody}</span>
            <input type="text" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </label>
        }
        confirmLabel={t.credit}
        onConfirm={credit}
      />
    </div>
  );
}

/** The accountant's CSV on the invoices list (managers; the action checks again). */
export function AccountingExport() {
  const t = useText();
  const now = today();
  const [from, setFrom] = useState(`${now.slice(0, 7)}-01`);
  const [to, setTo] = useState(now);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const res = await exportDocumentsAction(null, { from, to });
    setBusy(false);
    if (!res.ok) return void toast.error(t.error);
    if (res.data.rows === 0) return void toast.info(t.none);
    saveFile(res.data.name, res.data.csv);
  }

  return (
    <section className="gg-card gg-io gg-list-tool">
      <header className="gg-card__head">
        <div>
          <h2>{t.exportTitle}</h2>
          <p>{t.exportIntro}</p>
        </div>
      </header>
      <div className="gg-io__body">
        <div className="gg-actions">
          <label className="gg-io__date">
            <span>{t.from}</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="gg-io__date">
            <span>{t.to}</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="gg-btn" disabled={busy || !from || !to} onClick={() => void run()}>
            <Download />
            <span>{t.exportButton}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
