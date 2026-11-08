'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { CircleCheck, Download, FileUp, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { saveFile } from '@/components/admin/save-file';
import { checkCatalogueImport, exportCatalogueFile, inspectImportFile, runCatalogueImport } from '../actions';
import type { Mapping } from '../import';

// The catalogue half of the Import / Export page (components/admin/import-export.tsx): a spreadsheet in, mapped to the
// template's columns, checked, then written in batches; and the catalogue out in the same format.

type Lang = 'fr' | 'en' | 'de' | 'pt';
type Option = { value: string; label: Record<Lang, string> };
export type FieldOptions = { kind: Option[]; vat_class: Option[]; status: Option[]; colour: Option[]; category_slug: Option[] };
type Source = Mapping[keyof Mapping];
type Check = { rows: number; create: number; update: number; errors: { row: number; column: string; message: string }[]; errorCount: number };

const LANGS: Lang[] = ['fr', 'en', 'de', 'pt'];
const FIELD: Record<string, Record<Lang, string>> = {
  sku: { fr: 'Référence (SKU)', en: 'Reference (SKU)', de: 'Artikelnummer (SKU)', pt: 'Referência (SKU)' },
  barcode: { fr: 'Code-barres', en: 'Barcode', de: 'Strichcode', pt: 'Código de barras' },
  name: { fr: 'Nom', en: 'Name', de: 'Name', pt: 'Nome' },
  kind: { fr: 'Type de produit', en: 'Product type', de: 'Produktart', pt: 'Tipo de produto' },
  category_slug: { fr: 'Catégorie', en: 'Category', de: 'Kategorie', pt: 'Categoria' },
  brand: { fr: 'Producteur', en: 'Producer', de: 'Erzeuger', pt: 'Produtor' },
  region_fr: { fr: 'Région (FR)', en: 'Region (FR)', de: 'Region (FR)', pt: 'Região (FR)' },
  vintage: { fr: 'Millésime', en: 'Vintage', de: 'Jahrgang', pt: 'Colheita' },
  colour: { fr: 'Couleur du vin', en: 'Wine colour', de: 'Weinfarbe', pt: 'Cor do vinho' },
  vat_class: { fr: 'TVA', en: 'VAT', de: 'MwSt.', pt: 'IVA' },
  price_eur: { fr: 'Prix de vente TTC (€)', en: 'Selling price incl. VAT (€)', de: 'Verkaufspreis inkl. MwSt. (€)', pt: 'Preço de venda c/ IVA (€)' },
  cost_eur: { fr: 'Prix d’achat HT (€)', en: 'Purchase cost excl. VAT (€)', de: 'Einkaufspreis netto (€)', pt: 'Custo s/ IVA (€)' },
  box6_barcode: { fr: 'Carton de 6 : code-barres', en: 'Box of 6: barcode', de: '6er-Karton: Strichcode', pt: 'Caixa de 6: código de barras' },
  box6_price_eur: { fr: 'Carton de 6 : prix TTC (€)', en: 'Box of 6: price incl. VAT (€)', de: '6er-Karton: Preis inkl. MwSt. (€)', pt: 'Caixa de 6: preço c/ IVA (€)' },
  box12_barcode: { fr: 'Carton de 12 : code-barres', en: 'Box of 12: barcode', de: '12er-Karton: Strichcode', pt: 'Caixa de 12: código de barras' },
  box12_price_eur: { fr: 'Carton de 12 : prix TTC (€)', en: 'Box of 12: price incl. VAT (€)', de: '12er-Karton: Preis inkl. MwSt. (€)', pt: 'Caixa de 12: preço c/ IVA (€)' },
  opening_stock: { fr: 'Stock de départ (nouveaux formats)', en: 'Opening stock (new sizes)', de: 'Anfangsbestand (neue Formate)', pt: 'Stock inicial (formatos novos)' },
  low_stock: { fr: 'Alerte stock bas', en: 'Low-stock alert', de: 'Warnung bei niedrigem Bestand', pt: 'Alerta de stock baixo' },
  status: { fr: 'Statut', en: 'Status', de: 'Status', pt: 'Estado' },
  description: { fr: 'Description', en: 'Description', de: 'Beschreibung', pt: 'Descrição' },
};
const fieldLabel = (column: string, lang: Lang) => {
  const [base, suffix] = /^(name|description)_(fr|en|de|pt)$/.test(column) ? column.split('_') : [column];
  return `${FIELD[base]?.[lang] ?? column}${suffix ? ` (${suffix.toUpperCase()})` : ''}`;
};

const TEXT = {
  fr: {
    title: 'Importer des produits',
    intro: 'Un fichier Excel (.xlsx) ou CSV, une ligne par produit. Un produit existant est retrouvé par sa référence, sinon par son code-barres : rien n’est créé en double. Seules les colonnes importées changent. Les nouveaux produits arrivent « En préparation » : publiez-les après vérification.',
    choose: 'Choisir un fichier',
    template: 'Télécharger le modèle',
    lines: (n: number) => `${n} ligne${n > 1 ? 's' : ''} dans le fichier`,
    field: 'Champ',
    source: 'Pris dans',
    example: 'Exemple',
    skip: '— non importé (inchangé)',
    fixed: 'Même valeur pour toutes les lignes',
    column: (h: string) => `Colonne « ${h} »`,
    pickValue: 'Choisir…',
    check: 'Vérifier le fichier',
    checked: (c: number, u: number) => `${c} produit${c > 1 ? 's' : ''} à créer, ${u} à mettre à jour.`,
    errorsTitle: (n: number) => `${n} problème${n > 1 ? 's' : ''} : rien n’est enregistré tant qu’il en reste.`,
    moreErrors: (n: number) => `… et ${n} autre${n > 1 ? 's' : ''}.`,
    row: 'Ligne',
    problem: 'Problème',
    import: 'Importer',
    progress: (d: number, t: number) => `Import en cours… ${d} / ${t}`,
    done: (c: number, u: number) => `Import terminé : ${c} produit${c > 1 ? 's' : ''} créé${c > 1 ? 's' : ''} (en préparation), ${u} mis à jour.`,
    drafts: 'Voir les produits en préparation',
    exportTitle: 'Exporter le catalogue',
    exportIntro: 'Tous les produits et formats dans le format d’import, avec le stock actuel : modifiez-le dans Excel, puis importez-le ici.',
    exportButton: 'Exporter (CSV pour Excel)',
    errors: { size: 'Fichier vide ou trop gros (10 Mo au plus).', check: 'Le fichier contient des erreurs ou a changé : vérifiez-le à nouveau.', unreadable: 'Fichier illisible : enregistrez-le en .xlsx ou en .csv.', other: 'Opération impossible. Réessayez.' },
  },
  en: {
    title: 'Import products',
    intro: 'An Excel (.xlsx) or CSV file, one row per product. An existing product is found by its reference, otherwise by its barcode: nothing is created twice. Only the imported columns change. New products arrive “Being prepared”: publish them once checked.',
    choose: 'Choose a file',
    template: 'Download the template',
    lines: (n: number) => `${n} row${n > 1 ? 's' : ''} in the file`,
    field: 'Field',
    source: 'Taken from',
    example: 'Example',
    skip: '— not imported (unchanged)',
    fixed: 'The same value for every row',
    column: (h: string) => `Column “${h}”`,
    pickValue: 'Choose…',
    check: 'Check the file',
    checked: (c: number, u: number) => `${c} product${c > 1 ? 's' : ''} to create, ${u} to update.`,
    errorsTitle: (n: number) => `${n} problem${n > 1 ? 's' : ''}: nothing is saved while any remain.`,
    moreErrors: (n: number) => `… and ${n} more.`,
    row: 'Row',
    problem: 'Problem',
    import: 'Import',
    progress: (d: number, t: number) => `Importing… ${d} / ${t}`,
    done: (c: number, u: number) => `Import finished: ${c} product${c > 1 ? 's' : ''} created (being prepared), ${u} updated.`,
    drafts: 'See the products being prepared',
    exportTitle: 'Export the catalogue',
    exportIntro: 'Every product and size in the import format, with the current stock: edit it in Excel, then import it here.',
    exportButton: 'Export (CSV for Excel)',
    errors: { size: 'The file is empty or too large (10 MB at most).', check: 'The file has errors or has changed: check it again.', unreadable: 'Unreadable file: save it as .xlsx or .csv.', other: 'Could not do that. Try again.' },
  },
  de: {
    title: 'Produkte importieren',
    intro: 'Eine Excel- (.xlsx) oder CSV-Datei, eine Zeile pro Produkt. Ein vorhandenes Produkt wird über seine Artikelnummer gefunden, sonst über den Strichcode: nichts wird doppelt angelegt. Nur die importierten Spalten ändern sich. Neue Produkte kommen „In Vorbereitung“ an: nach der Prüfung veröffentlichen.',
    choose: 'Datei wählen',
    template: 'Vorlage herunterladen',
    lines: (n: number) => `${n} Zeile${n > 1 ? 'n' : ''} in der Datei`,
    field: 'Feld',
    source: 'Übernommen aus',
    example: 'Beispiel',
    skip: '— nicht importiert (unverändert)',
    fixed: 'Derselbe Wert für alle Zeilen',
    column: (h: string) => `Spalte „${h}“`,
    pickValue: 'Wählen…',
    check: 'Datei prüfen',
    checked: (c: number, u: number) => `${c} Produkt${c > 1 ? 'e' : ''} anzulegen, ${u} zu aktualisieren.`,
    errorsTitle: (n: number) => `${n} Problem${n > 1 ? 'e' : ''}: Es wird nichts gespeichert, solange welche bleiben.`,
    moreErrors: (n: number) => `… und ${n} weitere.`,
    row: 'Zeile',
    problem: 'Problem',
    import: 'Importieren',
    progress: (d: number, t: number) => `Import läuft… ${d} / ${t}`,
    done: (c: number, u: number) => `Import beendet: ${c} Produkt${c > 1 ? 'e' : ''} angelegt (in Vorbereitung), ${u} aktualisiert.`,
    drafts: 'Produkte in Vorbereitung ansehen',
    exportTitle: 'Katalog exportieren',
    exportIntro: 'Alle Produkte und Formate im Importformat, mit dem aktuellen Bestand: in Excel bearbeiten und hier wieder importieren.',
    exportButton: 'Exportieren (CSV für Excel)',
    errors: { size: 'Die Datei ist leer oder zu groß (höchstens 10 MB).', check: 'Die Datei enthält Fehler oder wurde geändert: erneut prüfen.', unreadable: 'Datei nicht lesbar: als .xlsx oder .csv speichern.', other: 'Das ging nicht. Bitte erneut versuchen.' },
  },
  pt: {
    title: 'Importar produtos',
    intro: 'Um ficheiro Excel (.xlsx) ou CSV, uma linha por produto. Um produto existente é encontrado pela referência, senão pelo código de barras: nada é criado em duplicado. Só as colunas importadas mudam. Os produtos novos chegam «Em preparação»: publique-os depois de verificados.',
    choose: 'Escolher um ficheiro',
    template: 'Descarregar o modelo',
    lines: (n: number) => `${n} linha${n > 1 ? 's' : ''} no ficheiro`,
    field: 'Campo',
    source: 'Retirado de',
    example: 'Exemplo',
    skip: '— não importado (sem alteração)',
    fixed: 'O mesmo valor para todas as linhas',
    column: (h: string) => `Coluna «${h}»`,
    pickValue: 'Escolher…',
    check: 'Verificar o ficheiro',
    checked: (c: number, u: number) => `${c} produto${c > 1 ? 's' : ''} a criar, ${u} a atualizar.`,
    errorsTitle: (n: number) => `${n} problema${n > 1 ? 's' : ''}: nada é guardado enquanto houver algum.`,
    moreErrors: (n: number) => `… e mais ${n}.`,
    row: 'Linha',
    problem: 'Problema',
    import: 'Importar',
    progress: (d: number, t: number) => `A importar… ${d} / ${t}`,
    done: (c: number, u: number) => `Importação concluída: ${c} produto${c > 1 ? 's' : ''} criado${c > 1 ? 's' : ''} (em preparação), ${u} atualizado${u > 1 ? 's' : ''}.`,
    drafts: 'Ver os produtos em preparação',
    exportTitle: 'Exportar o catálogo',
    exportIntro: 'Todos os produtos e formatos no formato de importação, com o stock atual: edite-o no Excel e importe-o aqui.',
    exportButton: 'Exportar (CSV para Excel)',
    errors: { size: 'Ficheiro vazio ou demasiado grande (10 MB no máximo).', check: 'O ficheiro tem erros ou mudou: verifique-o de novo.', unreadable: 'Ficheiro ilegível: guarde-o em .xlsx ou .csv.', other: 'Não foi possível. Tente de novo.' },
  },
};

// The import's row errors are written in English (CLI log, tests); here they are said in the admin's language.
const ROW_ERRORS: [RegExp, Record<Lang, string>][] = [
  [/^required to create a product$/, { fr: 'obligatoire pour créer un produit', en: 'needed to create a product', de: 'zum Anlegen eines Produkts nötig', pt: 'obrigatório para criar um produto' }],
  [/^a sku or a barcode is needed to find the product again$/, { fr: 'il faut une référence ou un code-barres', en: 'a reference or a barcode is needed', de: 'Artikelnummer oder Strichcode nötig', pt: 'é preciso uma referência ou um código de barras' }],
  [/^a sku or a barcode column is needed/, { fr: 'il faut prendre la Référence ou le Code-barres dans une colonne', en: 'take the Reference or the Barcode from a column', de: 'Artikelnummer oder Strichcode aus einer Spalte übernehmen', pt: 'retire a Referência ou o Código de barras de uma coluna' }],
  [/^same sku as row (\d+)$/, { fr: 'même référence que la ligne $1', en: 'same reference as row $1', de: 'gleiche Artikelnummer wie Zeile $1', pt: 'mesma referência que a linha $1' }],
  [/^no category "(.*)"$/, { fr: 'aucune catégorie « $1 »', en: 'no category “$1”', de: 'keine Kategorie „$1“', pt: 'nenhuma categoria «$1»' }],
  [/^the category is a \w+ category, the product is \w+$/, { fr: 'la catégorie ne convient pas à ce type de produit (comptoir ou boutique)', en: 'the category does not fit this product type (counter or shop)', de: 'die Kategorie passt nicht zur Produktart (Theke oder Shop)', pt: 'a categoria não corresponde ao tipo de produto (balcão ou loja)' }],
  [/^needed with description_(\w+)$/, { fr: 'le nom est nécessaire avec la description ($1)', en: 'the name is needed with the description ($1)', de: 'der Name ist mit der Beschreibung nötig ($1)', pt: 'o nome é necessário com a descrição ($1)' }],
  [/^barcode (\d+) already used in row (\d+)$/, { fr: 'code-barres $1 déjà utilisé ligne $2', en: 'barcode $1 already used in row $2', de: 'Strichcode $1 schon in Zeile $2', pt: 'código de barras $1 já usado na linha $2' }],
  [/^barcode (\d+) belongs to sku (.*)$/, { fr: 'code-barres $1 déjà attribué au produit $2', en: 'barcode $1 already belongs to product $2', de: 'Strichcode $1 gehört schon zu Produkt $2', pt: 'código de barras $1 já pertence ao produto $2' }],
  [/^digits only \(4 to 14\)$/, { fr: 'chiffres uniquement (4 à 14)', en: 'digits only (4 to 14)', de: 'nur Ziffern (4 bis 14)', pt: 'só algarismos (4 a 14)' }],
  [/^"(.*)" is not an amount in euros$/, { fr: '« $1 » n’est pas un montant en euros', en: '“$1” is not an amount in euros', de: '„$1“ ist kein Betrag in Euro', pt: '«$1» não é um valor em euros' }],
  [/^"(.*)" is not a whole number ≥ 0$/, { fr: '« $1 » n’est pas un nombre entier ≥ 0', en: '“$1” is not a whole number ≥ 0', de: '„$1“ ist keine ganze Zahl ≥ 0', pt: '«$1» não é um número inteiro ≥ 0' }],
  [/^must be one of (.*)$/, { fr: 'valeur attendue : $1', en: 'expected: $1', de: 'erwartet: $1', pt: 'valor esperado: $1' }],
];
const rowError = (message: string, lang: Lang) => {
  for (const [re, text] of ROW_ERRORS) {
    const m = message.match(re);
    if (m) return text[lang].replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? '');
  }
  return message;
};

const encode = (source: Source) => (!source ? '' : 'column' in source ? `c:${source.column}` : 'v');

export default function CatalogueFiles({ columns, options }: { columns: string[]; options: FieldOptions }) {
  const { i18n } = useTranslation();
  const lang = (LANGS.includes(i18n.language as Lang) ? i18n.language : 'fr') as Lang;
  const t = TEXT[lang];
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<{ headers: string[]; sample: Record<string, string>[]; rows: number } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [check, setCheck] = useState<Check | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; created: number; updated: number; finished: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (res: { error: string; message?: string; fieldErrors?: Record<string, string[]> }) =>
    toast.error(res.fieldErrors?.file ? t.errors.size : res.message === 'check' ? t.errors.check : res.error === 'VALIDATION' ? t.errors.unreadable : t.errors.other);
  const form = (f: File, fields: Record<string, string> = {}) => {
    const data = new FormData();
    data.set('file', f);
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
  };
  const changeMapping = (next: Mapping) => {
    setMapping(next);
    setCheck(null);
    setProgress(null);
  };

  async function choose(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setInfo(null);
    setCheck(null);
    setProgress(null);
    setBusy(true);
    try {
      const res = await inspectImportFile(null, form(f));
      if (!res.ok) return fail(res);
      setInfo({ headers: res.data.headers, sample: res.data.sample, rows: res.data.rows });
      setMapping(res.data.mapping);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await checkCatalogueImport(null, form(file, { mapping: JSON.stringify(mapping) }));
      if (!res.ok) return fail(res);
      setCheck(res.data);
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!file || !check) return;
    setBusy(true);
    const state = { done: 0, total: check.rows, created: 0, updated: 0, finished: false };
    setProgress(state);
    try {
      for (let from: number | null = 0; from !== null; ) {
        const res = await runCatalogueImport(null, form(file, { mapping: JSON.stringify(mapping), from: String(from) }));
        if (!res.ok) return fail(res);
        Object.assign(state, { created: state.created + res.data.created, updated: state.updated + res.data.updated, done: res.data.next ?? res.data.total, total: res.data.total });
        setProgress({ ...state });
        from = res.data.next;
      }
      setProgress({ ...state, finished: true });
      setCheck(null);
    } finally {
      setBusy(false);
    }
  }

  async function exportAll() {
    setBusy(true);
    try {
      const res = await exportCatalogueFile(null, {});
      if (!res.ok) return fail(res);
      saveFile(res.data.name, res.data.csv);
    } finally {
      setBusy(false);
    }
  }

  const sample = (source: Source) => (source && 'column' in source ? info?.sample.find((r) => r[source.column])?.[source.column] : undefined);
  const choices = (column: string): Option[] | undefined => options[column as keyof FieldOptions];

  return (
    <>
      <section className="gg-card gg-io">
        <header className="gg-card__head">
          <div>
            <h2>{t.title}</h2>
            <p>{t.intro}</p>
          </div>
        </header>
        <div className="gg-io__body">
          <div className="gg-actions">
            <label className="gg-btn gg-btn--primary">
              <FileUp />
              <span>{file ? file.name : t.choose}</span>
              <input type="file" accept=".xlsx,.csv,.txt" hidden disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} />
            </label>
            <a className="gg-btn" href="/catalogue-template.csv" download>
              <Download />
              <span>{t.template}</span>
            </a>
            {info && <span className="gg-muted">{t.lines(info.rows)}</span>}
          </div>

          {info && (
            <>
              <div className="gg-stock__table gg-io__map">
                <table>
                  <thead>
                    <tr>
                      <th>{t.field}</th>
                      <th>{t.source}</th>
                      <th>{t.example}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((column) => {
                      const source = mapping[column as keyof Mapping];
                      const list = choices(column);
                      return (
                        <tr key={column} className={source ? 'gg-io__on' : undefined}>
                          <td>{fieldLabel(column, lang)}</td>
                          <td>
                            <select
                              value={encode(source)}
                              disabled={busy}
                              onChange={(e) => {
                                const v = e.target.value;
                                const next = { ...mapping };
                                if (!v) delete next[column as keyof Mapping];
                                else next[column as keyof Mapping] = v === 'v' ? { value: '' } : { column: v.slice(2) };
                                changeMapping(next);
                              }}
                            >
                              <option value="">{t.skip}</option>
                              {info.headers.filter(Boolean).map((h) => (
                                <option key={h} value={`c:${h}`}>
                                  {t.column(h)}
                                </option>
                              ))}
                              <option value="v">{t.fixed}</option>
                            </select>
                          </td>
                          <td>
                            {source && 'value' in source ? (
                              list ? (
                                <select value={source.value} disabled={busy} onChange={(e) => changeMapping({ ...mapping, [column]: { value: e.target.value } })}>
                                  <option value="">{t.pickValue}</option>
                                  {list.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label[lang] ?? o.label.fr}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input type="text" value={source.value} disabled={busy} onChange={(e) => changeMapping({ ...mapping, [column]: { value: e.target.value } })} />
                              )
                            ) : (
                              <span className="gg-muted">{sample(source) ?? ''}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="gg-actions">
                <button type="button" className="gg-btn" disabled={busy} onClick={() => void verify()}>
                  <CircleCheck />
                  <span>{t.check}</span>
                </button>
                {check && check.errorCount === 0 && (
                  <button type="button" className="gg-btn gg-btn--primary" disabled={busy || check.rows === 0} onClick={() => void run()}>
                    <Upload />
                    <span>{t.import}</span>
                  </button>
                )}
              </div>
            </>
          )}

          {check && <p className="gg-io__note">{t.checked(check.create, check.update)}</p>}
          {check && check.errorCount > 0 && (
            <>
              <p className="gg-io__note gg-io__note--bad">{t.errorsTitle(check.errorCount)}</p>
              <div className="gg-stock__table">
                <table>
                  <thead>
                    <tr>
                      <th>{t.row}</th>
                      <th>{t.field}</th>
                      <th>{t.problem}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.errors.map((e, i) => (
                      <tr key={i}>
                        <td>{e.row}</td>
                        <td>{e.column.split(', ').map((c) => fieldLabel(c, lang)).join(', ')}</td>
                        <td className="gg-io__wrap">{rowError(e.message, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {check.errorCount > check.errors.length && <p className="gg-muted">{t.moreErrors(check.errorCount - check.errors.length)}</p>}
            </>
          )}

          {progress && (
            <div className="gg-io__progress" role="status">
              <div className="gg-io__bar">
                <span style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }} />
              </div>
              <p className="gg-io__note">{progress.finished ? t.done(progress.created, progress.updated) : t.progress(progress.done, progress.total)}</p>
              {progress.finished && progress.created > 0 && (
                <Link className="gg-card__more" href="/admin/collections/products?where[status][equals]=draft">
                  {t.drafts}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="gg-card gg-io">
        <header className="gg-card__head">
          <div>
            <h2>{t.exportTitle}</h2>
            <p>{t.exportIntro}</p>
          </div>
          <button type="button" className="gg-btn" disabled={busy} onClick={() => void exportAll()}>
            <Download />
            <span>{t.exportButton}</span>
          </button>
        </header>
      </section>
    </>
  );
}
