'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { ClipboardCheck, Download, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { saveFile } from '@/components/admin/save-file';
import { today } from '@/lib/time';
import { exportStockMovements, importStockCount } from '../actions';

// The stock half of the Import / Export page (components/admin/import-export.tsx): a stock count from a file, which
// becomes an open count to check and post as usual, and the movement history as a CSV.

type Lang = 'fr' | 'en' | 'de' | 'pt';
type Skipped = { row: number; code: string; reason: 'quantity' | 'unknown' | 'untracked' };

const TEXT = {
  fr: {
    countTitle: 'Inventaire depuis un fichier',
    countIntro: 'Colonnes : « sku » (référence) ou « barcode » (code-barres), et « counted » (quantité comptée). Le code-barres d’un carton compte des cartons. Cela crée un inventaire « En cours » : vérifiez-le, puis validez-le comme d’habitude ; le stock ne change qu’à la validation.',
    choose: 'Choisir le fichier compté',
    created: (n: number) => `Inventaire créé avec ${n} produit${n > 1 ? 's' : ''} compté${n > 1 ? 's' : ''}.`,
    open: 'Ouvrir l’inventaire',
    nothing: 'Aucune ligne ne correspond à un produit suivi en stock : aucun inventaire créé.',
    skipped: (n: number) => `${n} ligne${n > 1 ? 's' : ''} non comptée${n > 1 ? 's' : ''} :`,
    row: 'Ligne',
    code: 'Code',
    why: 'Raison',
    reasons: { quantity: 'quantité absente ou invalide', unknown: 'aucun produit avec ce code', untracked: 'produit sans suivi de stock (comptoir)' },
    exportTitle: 'Exporter les mouvements de stock',
    exportIntro: 'Chaque entrée et sortie de stock (ventes, corrections, inventaires, réceptions) avec la date, la quantité, la raison et la personne.',
    from: 'Du',
    to: 'Au',
    exportButton: 'Exporter (CSV pour Excel)',
    none: 'Aucun mouvement sur cette période.',
    errors: { size: 'Fichier vide ou trop gros (10 Mo au plus).', columns: 'Colonnes introuvables : il faut « sku » ou « barcode », et « counted ».', unreadable: 'Fichier illisible : enregistrez-le en .xlsx ou en .csv.', other: 'Opération impossible. Réessayez.' },
  },
  en: {
    countTitle: 'Stock count from a file',
    countIntro: 'Columns: “sku” (reference) or “barcode”, and “counted” (quantity counted). A box’s barcode counts boxes. This creates a stock count “In progress”: check it, then post it as usual; stock changes only when it is posted.',
    choose: 'Choose the counted file',
    created: (n: number) => `Stock count created with ${n} product${n > 1 ? 's' : ''} counted.`,
    open: 'Open the stock count',
    nothing: 'No row matches a product whose stock is tracked: no stock count created.',
    skipped: (n: number) => `${n} row${n > 1 ? 's' : ''} not counted:`,
    row: 'Row',
    code: 'Code',
    why: 'Reason',
    reasons: { quantity: 'quantity missing or invalid', unknown: 'no product with this code', untracked: 'product without stock tracking (counter)' },
    exportTitle: 'Export stock movements',
    exportIntro: 'Every stock entry and exit (sales, corrections, counts, deliveries) with the date, quantity, reason and person.',
    from: 'From',
    to: 'To',
    exportButton: 'Export (CSV for Excel)',
    none: 'No movement in this period.',
    errors: { size: 'The file is empty or too large (10 MB at most).', columns: 'Columns not found: “sku” or “barcode”, and “counted” are needed.', unreadable: 'Unreadable file: save it as .xlsx or .csv.', other: 'Could not do that. Try again.' },
  },
  de: {
    countTitle: 'Inventur aus einer Datei',
    countIntro: 'Spalten: „sku“ (Artikelnummer) oder „barcode“ (Strichcode) und „counted“ (gezählte Menge). Der Strichcode eines Kartons zählt Kartons. Es entsteht eine offene Inventur: prüfen und wie gewohnt buchen; der Bestand ändert sich erst beim Buchen.',
    choose: 'Gezählte Datei wählen',
    created: (n: number) => `Inventur mit ${n} gezählten Produkt${n > 1 ? 'en' : ''} angelegt.`,
    open: 'Inventur öffnen',
    nothing: 'Keine Zeile passt zu einem Produkt mit Bestandsführung: keine Inventur angelegt.',
    skipped: (n: number) => `${n} Zeile${n > 1 ? 'n' : ''} nicht gezählt:`,
    row: 'Zeile',
    code: 'Code',
    why: 'Grund',
    reasons: { quantity: 'Menge fehlt oder ungültig', unknown: 'kein Produkt mit diesem Code', untracked: 'Produkt ohne Bestandsführung (Theke)' },
    exportTitle: 'Lagerbewegungen exportieren',
    exportIntro: 'Jeder Zu- und Abgang (Verkäufe, Korrekturen, Inventuren, Wareneingänge) mit Datum, Menge, Grund und Person.',
    from: 'Von',
    to: 'Bis',
    exportButton: 'Exportieren (CSV für Excel)',
    none: 'Keine Bewegung in diesem Zeitraum.',
    errors: { size: 'Die Datei ist leer oder zu groß (höchstens 10 MB).', columns: 'Spalten nicht gefunden: „sku“ oder „barcode“ und „counted“ sind nötig.', unreadable: 'Datei nicht lesbar: als .xlsx oder .csv speichern.', other: 'Das ging nicht. Bitte erneut versuchen.' },
  },
  pt: {
    countTitle: 'Inventário a partir de um ficheiro',
    countIntro: 'Colunas: «sku» (referência) ou «barcode» (código de barras), e «counted» (quantidade contada). O código de barras de uma caixa conta caixas. Cria um inventário «Em curso»: verifique-o e valide-o como de costume; o stock só muda ao validar.',
    choose: 'Escolher o ficheiro contado',
    created: (n: number) => `Inventário criado com ${n} produto${n > 1 ? 's' : ''} contado${n > 1 ? 's' : ''}.`,
    open: 'Abrir o inventário',
    nothing: 'Nenhuma linha corresponde a um produto com stock controlado: nenhum inventário criado.',
    skipped: (n: number) => `${n} linha${n > 1 ? 's' : ''} não contada${n > 1 ? 's' : ''}:`,
    row: 'Linha',
    code: 'Código',
    why: 'Motivo',
    reasons: { quantity: 'quantidade em falta ou inválida', unknown: 'nenhum produto com este código', untracked: 'produto sem controlo de stock (balcão)' },
    exportTitle: 'Exportar os movimentos de stock',
    exportIntro: 'Cada entrada e saída de stock (vendas, correções, inventários, receções) com a data, a quantidade, o motivo e a pessoa.',
    from: 'De',
    to: 'Até',
    exportButton: 'Exportar (CSV para Excel)',
    none: 'Nenhum movimento neste período.',
    errors: { size: 'Ficheiro vazio ou demasiado grande (10 MB no máximo).', columns: 'Colunas não encontradas: é preciso «sku» ou «barcode», e «counted».', unreadable: 'Ficheiro ilegível: guarde-o em .xlsx ou .csv.', other: 'Não foi possível. Tente de novo.' },
  },
};

export default function StockFiles() {
  const { i18n } = useTranslation();
  const lang = (i18n.language in TEXT ? i18n.language : 'fr') as Lang;
  const t = TEXT[lang];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ count: string | null; lines: number; skipped: Skipped[] } | null>(null);
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`);
  const [to, setTo] = useState(today());

  const fail = (res: { error: string; message?: string; fieldErrors?: Record<string, string[]> }) =>
    toast.error(res.fieldErrors?.file ? t.errors.size : res.message === 'columns' ? t.errors.columns : res.error === 'VALIDATION' ? t.errors.unreadable : t.errors.other);

  async function count(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const data = new FormData();
      data.set('file', file);
      const res = await importStockCount(null, data);
      if (!res.ok) return fail(res);
      setResult(res.data);
    } finally {
      setBusy(false);
    }
  }

  async function exportMovements() {
    setBusy(true);
    try {
      const res = await exportStockMovements(null, { from, to, lang });
      if (!res.ok) return fail(res);
      if (res.data.rows === 0) return toast.info(t.none);
      saveFile(res.data.name, res.data.csv);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="gg-card gg-io">
        <header className="gg-card__head">
          <div>
            <h2>{t.countTitle}</h2>
            <p>{t.countIntro}</p>
          </div>
        </header>
        <div className="gg-io__body">
          <div className="gg-actions">
            <label className="gg-btn">
              <FileUp />
              <span>{t.choose}</span>
              <input type="file" accept=".xlsx,.csv,.txt" hidden disabled={busy} onChange={(e) => void count(e.target.files?.[0])} />
            </label>
          </div>
          {result && (
            <>
              <p className={result.count ? 'gg-io__note' : 'gg-io__note gg-io__note--bad'}>{result.count ? t.created(result.lines) : t.nothing}</p>
              {result.count && (
                <Link className="gg-btn gg-btn--primary" href={`/admin/collections/stockCounts/${result.count}`}>
                  <ClipboardCheck />
                  <span>{t.open}</span>
                </Link>
              )}
              {result.skipped.length > 0 && (
                <>
                  <p className="gg-io__note">{t.skipped(result.skipped.length)}</p>
                  <div className="gg-stock__table">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.row}</th>
                          <th>{t.code}</th>
                          <th>{t.why}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.skipped.map((s) => (
                          <tr key={s.row}>
                            <td>{s.row}</td>
                            <td>{s.code}</td>
                            <td>{t.reasons[s.reason]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="gg-card gg-io">
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
            <button type="button" className="gg-btn" disabled={busy || !from || !to} onClick={() => void exportMovements()}>
              <Download />
              <span>{t.exportButton}</span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
