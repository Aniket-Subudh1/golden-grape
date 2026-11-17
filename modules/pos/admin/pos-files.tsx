'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { Check, FileUp } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import { assignPosCode, confirmPosImport, previewPosFile } from '../actions';
import type { ImportPreview } from '../service';

// "Ventes de la caisse" on the Import / Export page (M3.3 T5): the till's daily sales file → what it would import
// (receipts, lines, codes not found, unreadable rows) → fix a code by giving the right SKU or barcode → import.

type Lang = 'fr' | 'en' | 'de' | 'pt';

const TEXT = {
  fr: {
    title: 'Ventes de la caisse', intro: 'Le fichier des ventes du jour exporté de la caisse (CashMag, .csv ou .xlsx). Chaque ticket devient une vente « Caisse » et sort du stock. Le même fichier ne peut pas être importé deux fois. Les noms de colonnes se règlent dans Infos de la boutique › Modules et alertes › Caisse.',
    choose: 'Choisir le fichier de la caisse', summary: (r: number, l: number, d: string, t: string) => `${r} ticket(s), ${l} ligne(s), ${d} · ${t}`,
    ready: (r: number, l: number) => `Prêt à importer : ${r} ticket(s), ${l} ligne(s)`, receipt: 'Ticket', when: 'Date', items: 'Articles', total: 'Total',
    unmatched: 'Codes sans article', unmatchedHelp: 'Indiquez la référence (SKU) ou le code-barres de l’article vendu sous ce code, puis « Utiliser ». Ces lignes ne sont pas importées tant qu’elles ne sont pas réglées.', code: 'Code dans le fichier', lines: 'Lignes', qty: 'Qté', use: 'Utiliser', target: 'SKU ou code-barres',
    errors: 'Lignes illisibles (non importées)', line: 'Ligne', why: 'Raison', reasons: { columns: 'colonnes en trop (virgule non entre guillemets ?)', receipt: 'n° de ticket manquant', date: 'date illisible', qty: 'quantité invalide (entier positif)', price: 'prix illisible', code: 'ni code-barres ni référence' },
    confirm: (r: number) => `Importer ${r} ticket(s)`, done: (n: number) => `${n} vente(s) importée(s).`, left: (n: number) => `${n} ligne(s) attendent encore un article.`, posted: (n: number) => `${n} ligne(s) déjà importée(s) de ce fichier.`, finished: 'Fichier entièrement importé.',
    fail: { alreadyImported: 'Ce fichier a déjà été importé.', size: 'Fichier vide ou trop gros (10 Mo au plus).', noRows: 'Aucune vente lisible dans ce fichier.', unknownCode: 'Aucun article avec ce SKU ou code-barres.', nothingToImport: 'Rien à importer : réglez d’abord les codes sans article.', columns: 'Colonnes introuvables : ', other: 'Opération impossible. Réessayez.' },
  },
  en: {
    title: 'Till sales', intro: 'The day’s sales file exported from the till (CashMag, .csv or .xlsx). Each receipt becomes a “Till” sale and leaves stock. The same file cannot be imported twice. Column names are set in Shop details › Modules and alerts › Till.',
    choose: 'Choose the till file', summary: (r: number, l: number, d: string, t: string) => `${r} receipt(s), ${l} line(s), ${d} · ${t}`,
    ready: (r: number, l: number) => `Ready to import: ${r} receipt(s), ${l} line(s)`, receipt: 'Receipt', when: 'Date', items: 'Items', total: 'Total',
    unmatched: 'Codes without an item', unmatchedHelp: 'Enter the SKU or barcode of the item sold under this code, then “Use”. These lines are not imported until they are fixed.', code: 'Code in the file', lines: 'Lines', qty: 'Qty', use: 'Use', target: 'SKU or barcode',
    errors: 'Unreadable lines (not imported)', line: 'Line', why: 'Reason', reasons: { columns: 'too many columns (comma not in quotes?)', receipt: 'receipt number missing', date: 'unreadable date', qty: 'invalid quantity (whole number above 0)', price: 'unreadable price', code: 'no barcode or reference' },
    confirm: (r: number) => `Import ${r} receipt(s)`, done: (n: number) => `${n} sale(s) imported.`, left: (n: number) => `${n} line(s) still need an item.`, posted: (n: number) => `${n} line(s) of this file already imported.`, finished: 'File fully imported.',
    fail: { alreadyImported: 'This file has already been imported.', size: 'The file is empty or too large (10 MB at most).', noRows: 'No readable sale in this file.', unknownCode: 'No item with this SKU or barcode.', nothingToImport: 'Nothing to import: fix the codes without an item first.', columns: 'Columns not found: ', other: 'Could not do that. Try again.' },
  },
  de: {
    title: 'Kassenverkäufe', intro: 'Die aus der Kasse exportierte Tagesverkaufsdatei (CashMag, .csv oder .xlsx). Jeder Bon wird ein „Kasse“-Verkauf und geht vom Bestand ab. Dieselbe Datei kann nicht zweimal importiert werden. Spaltennamen unter Geschäftsdaten › Module und Warnungen › Kasse.',
    choose: 'Kassendatei wählen', summary: (r: number, l: number, d: string, t: string) => `${r} Bon(s), ${l} Zeile(n), ${d} · ${t}`,
    ready: (r: number, l: number) => `Bereit zum Import: ${r} Bon(s), ${l} Zeile(n)`, receipt: 'Bon', when: 'Datum', items: 'Artikel', total: 'Summe',
    unmatched: 'Codes ohne Artikel', unmatchedHelp: 'Artikelnummer (SKU) oder Strichcode des unter diesem Code verkauften Artikels eingeben, dann „Verwenden“. Diese Zeilen werden erst nach der Korrektur importiert.', code: 'Code in der Datei', lines: 'Zeilen', qty: 'Menge', use: 'Verwenden', target: 'SKU oder Strichcode',
    errors: 'Unlesbare Zeilen (nicht importiert)', line: 'Zeile', why: 'Grund', reasons: { columns: 'zu viele Spalten (Komma ohne Anführungszeichen?)', receipt: 'Bonnummer fehlt', date: 'Datum unlesbar', qty: 'ungültige Menge (ganze Zahl über 0)', price: 'Preis unlesbar', code: 'weder Strichcode noch Artikelnummer' },
    confirm: (r: number) => `${r} Bon(s) importieren`, done: (n: number) => `${n} Verkauf/Verkäufe importiert.`, left: (n: number) => `${n} Zeile(n) brauchen noch einen Artikel.`, posted: (n: number) => `${n} Zeile(n) dieser Datei bereits importiert.`, finished: 'Datei vollständig importiert.',
    fail: { alreadyImported: 'Diese Datei wurde bereits importiert.', size: 'Die Datei ist leer oder zu groß (höchstens 10 MB).', noRows: 'Kein lesbarer Verkauf in dieser Datei.', unknownCode: 'Kein Artikel mit dieser SKU oder diesem Strichcode.', nothingToImport: 'Nichts zu importieren: zuerst die Codes ohne Artikel korrigieren.', columns: 'Spalten nicht gefunden: ', other: 'Das ging nicht. Bitte erneut versuchen.' },
  },
  pt: {
    title: 'Vendas da caixa', intro: 'O ficheiro de vendas do dia exportado da caixa (CashMag, .csv ou .xlsx). Cada talão passa a uma venda «Caixa» e sai do stock. O mesmo ficheiro não pode ser importado duas vezes. Os nomes das colunas definem-se em Dados da loja › Módulos e alertas › Caixa.',
    choose: 'Escolher o ficheiro da caixa', summary: (r: number, l: number, d: string, t: string) => `${r} talão(ões), ${l} linha(s), ${d} · ${t}`,
    ready: (r: number, l: number) => `Pronto a importar: ${r} talão(ões), ${l} linha(s)`, receipt: 'Talão', when: 'Data', items: 'Artigos', total: 'Total',
    unmatched: 'Códigos sem artigo', unmatchedHelp: 'Indique a referência (SKU) ou o código de barras do artigo vendido com este código e depois «Usar». Estas linhas só são importadas depois de corrigidas.', code: 'Código no ficheiro', lines: 'Linhas', qty: 'Qtd', use: 'Usar', target: 'SKU ou código de barras',
    errors: 'Linhas ilegíveis (não importadas)', line: 'Linha', why: 'Motivo', reasons: { columns: 'colunas a mais (vírgula sem aspas?)', receipt: 'n.º de talão em falta', date: 'data ilegível', qty: 'quantidade inválida (inteiro acima de 0)', price: 'preço ilegível', code: 'sem código de barras nem referência' },
    confirm: (r: number) => `Importar ${r} talão(ões)`, done: (n: number) => `${n} venda(s) importada(s).`, left: (n: number) => `${n} linha(s) ainda precisam de um artigo.`, posted: (n: number) => `${n} linha(s) deste ficheiro já importada(s).`, finished: 'Ficheiro totalmente importado.',
    fail: { alreadyImported: 'Este ficheiro já foi importado.', size: 'Ficheiro vazio ou demasiado grande (10 MB no máximo).', noRows: 'Nenhuma venda legível neste ficheiro.', unknownCode: 'Nenhum artigo com este SKU ou código de barras.', nothingToImport: 'Nada a importar: corrija primeiro os códigos sem artigo.', columns: 'Colunas não encontradas: ', other: 'Não foi possível. Tente de novo.' },
  },
};

export default function PosFiles({ initial }: { initial?: ImportPreview | null }) {
  const { i18n } = useTranslation();
  const lang = (i18n.language in TEXT ? i18n.language : 'fr') as Lang;
  const t = TEXT[lang];
  const money = (cents: number) => formatMoney(cents, lang);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(initial ?? null);
  const [targets, setTargets] = useState<Record<string, string>>({});

  const fail = (res: { error: string; message?: string; fieldErrors?: Record<string, string[]> }) => {
    const key = res.fieldErrors?.file?.[0] ?? res.fieldErrors?.target?.[0] ?? res.message ?? '';
    if (key.startsWith('columns:')) return void toast.error(t.fail.columns + key.slice(8));
    toast.error((t.fail as Record<string, string>)[key] ?? t.fail.other);
  };
  const run = async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string; message?: string; fieldErrors?: Record<string, string[]> }>, then: (data: T) => void) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) return fail(res);
      then(res.data);
    } finally {
      setBusy(false);
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    const data = new FormData();
    data.set('file', file);
    void run(() => previewPosFile(null, data), setPreview);
  };

  const readyLines = preview?.ready.reduce((n, r) => n + r.lines.length, 0) ?? 0;

  return (
    <section className="gg-card gg-io" data-testid="pos-import">
      <header className="gg-card__head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.intro}</p>
        </div>
      </header>
      <div className="gg-io__body">
        <div className="gg-actions">
          <label className="gg-btn">
            <FileUp />
            <span>{t.choose}</span>
            <input type="file" accept=".csv,.txt,.xlsx" hidden disabled={busy} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
        </div>
        {preview && (
          <>
            <p className="gg-io__note">
              <b>{preview.filename}</b> · {t.summary(preview.receipts, preview.lines, preview.days.join(', '), money(preview.totalCents))}
            </p>
            {preview.posted > 0 && <p className="gg-io__note">{preview.unmatched.length || preview.ready.length ? t.posted(preview.posted) : t.finished}</p>}

            {preview.unmatched.length > 0 && (
              <>
                <p className="gg-io__note gg-io__note--bad">
                  <b>{t.unmatched}</b> — {t.unmatchedHelp}
                </p>
                <div className="gg-stock__table">
                  <table data-testid="pos-unmatched">
                    <thead>
                      <tr>
                        <th>{t.code}</th>
                        <th>{t.lines}</th>
                        <th>{t.qty}</th>
                        <th>{t.target}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.unmatched.map((u) => (
                        <tr key={u.code}>
                          <td>{u.code}</td>
                          <td>{u.lines.join(', ')}</td>
                          <td>{u.qty}</td>
                          <td>
                            <span className="gg-actions">
                              <input className="gg-pos__target" aria-label={`${t.target} ${u.code}`} value={targets[u.code] ?? ''} onChange={(e) => setTargets({ ...targets, [u.code]: e.target.value })} />
                              <button type="button" className="gg-btn" disabled={busy || !targets[u.code]?.trim()} onClick={() => void run(() => assignPosCode(null, { id: preview.id, code: u.code, target: targets[u.code] }), setPreview)}>
                                {t.use}
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {preview.errors.length > 0 && (
              <>
                <p className="gg-io__note">{t.errors}</p>
                <div className="gg-stock__table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.line}</th>
                        <th>{t.why}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.map((e) => (
                        <tr key={e.line}>
                          <td>{e.line}</td>
                          <td>{t.reasons[e.reason]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {preview.ready.length > 0 && (
              <>
                <p className="gg-io__note">{t.ready(preview.ready.length, readyLines)}</p>
                <div className="gg-stock__table">
                  <table data-testid="pos-ready">
                    <thead>
                      <tr>
                        <th>{t.receipt}</th>
                        <th>{t.when}</th>
                        <th>{t.items}</th>
                        <th>{t.total}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.ready.slice(0, 50).map((r) => (
                        <tr key={r.receipt}>
                          <td>{r.receipt}</td>
                          <td>
                            {r.date.split('-').reverse().join('/')} {r.time}
                          </td>
                          <td>{r.lines.map((l) => `${l.qty} × ${l.name}${l.factor > 1 ? ` (${l.factor})` : ''}`).join(', ')}</td>
                          <td>{money(r.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="gg-actions">
                  <button
                    type="button"
                    className="gg-btn gg-btn--primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => confirmPosImport(null, { id: preview.id }),
                        (d) => {
                          toast.success(`${t.done(d.orders.length)}${d.left ? ` ${t.left(d.left)}` : ''}`);
                          setPreview(d.preview);
                        },
                      )
                    }
                  >
                    <Check />
                    <span>{t.confirm(preview.ready.length)}</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
