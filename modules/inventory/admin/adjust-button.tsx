'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { ChevronLeft, ChevronRight, PackageMinus } from 'lucide-react';
import { type KeyboardEvent, useEffect, useState } from 'react';
import type { Label } from '@/lib/admin';
import { adjustStock, setLowStockAlert } from '../actions';
import { ADJUST_REASONS, REASON_LABELS, TYPE_LABELS } from '../labels';

// The variant's "Stock" tab (rendered by stock-panel.tsx): level and alert, "Correct stock", and the movement
// history read through Payload's REST API (access-checked), reloaded after every change.

type Lang = keyof Label;
const pick = (label: Label | undefined, lang: Lang) => (label ? (label[lang] ?? label.fr) : undefined);

const TEXT = {
  fr: {
    inStock: 'En stock',
    units: 'unités',
    low: 'Stock bas',
    alertAt: 'Alerte à partir de',
    alertHint: (n: number) => `Vide : ${n}, la valeur des réglages.`,
    saveAlert: 'Enregistrer l’alerte',
    adjust: 'Corriger le stock',
    qty: 'Quantité (+ ajoute, − retire)',
    reason: 'Raison',
    note: 'Précisez (3 caractères au moins)',
    confirm: 'Enregistrer la correction',
    cancel: 'Annuler',
    saved: 'Enregistré.',
    history: 'Historique du stock',
    empty: 'Aucun mouvement pour l’instant.',
    when: 'Date',
    type: 'Type',
    quantity: 'Quantité',
    box: 'Carton',
    why: 'Raison',
    by: 'Par',
    source: 'Origine',
    count: 'Inventaire',
    page: (p: number, n: number) => `Page ${p} sur ${n}`,
    errors: {
      OUT_OF_STOCK: 'Pas assez de stock pour retirer cette quantité.',
      VALIDATION: 'Vérifiez la quantité et la raison.',
      FORBIDDEN: 'Votre rôle ne permet pas de corriger le stock.',
      other: 'Impossible d’enregistrer. Réessayez.',
    },
  },
  en: {
    inStock: 'In stock',
    units: 'units',
    low: 'Low stock',
    alertAt: 'Alert at',
    alertHint: (n: number) => `Empty: ${n}, the value from the settings.`,
    saveAlert: 'Save alert',
    adjust: 'Correct stock',
    qty: 'Quantity (+ adds, − removes)',
    reason: 'Reason',
    note: 'Explain (at least 3 characters)',
    confirm: 'Save correction',
    cancel: 'Cancel',
    saved: 'Saved.',
    history: 'Stock history',
    empty: 'No movement yet.',
    when: 'Date',
    type: 'Type',
    quantity: 'Quantity',
    box: 'Box',
    why: 'Reason',
    by: 'By',
    source: 'Source',
    count: 'Stock count',
    page: (p: number, n: number) => `Page ${p} of ${n}`,
    errors: {
      OUT_OF_STOCK: 'Not enough stock to remove that quantity.',
      VALIDATION: 'Check the quantity and the reason.',
      FORBIDDEN: 'Your role cannot correct stock.',
      other: 'Could not save. Try again.',
    },
  },
  de: {
    inStock: 'Auf Lager',
    units: 'Einheiten',
    low: 'Niedriger Bestand',
    alertAt: 'Warnung ab',
    alertHint: (n: number) => `Leer: ${n}, der Wert der Einstellungen.`,
    saveAlert: 'Warnung speichern',
    adjust: 'Bestand korrigieren',
    qty: 'Menge (+ fügt hinzu, − entnimmt)',
    reason: 'Grund',
    note: 'Erläutern (mindestens 3 Zeichen)',
    confirm: 'Korrektur speichern',
    cancel: 'Abbrechen',
    saved: 'Gespeichert.',
    history: 'Lagerverlauf',
    empty: 'Noch keine Bewegung.',
    when: 'Datum',
    type: 'Art',
    quantity: 'Menge',
    box: 'Karton',
    why: 'Grund',
    by: 'Von',
    source: 'Ursprung',
    count: 'Inventur',
    page: (p: number, n: number) => `Seite ${p} von ${n}`,
    errors: {
      OUT_OF_STOCK: 'Nicht genug Bestand, um diese Menge zu entnehmen.',
      VALIDATION: 'Prüfen Sie Menge und Grund.',
      FORBIDDEN: 'Ihre Rolle darf den Bestand nicht korrigieren.',
      other: 'Speichern nicht möglich. Bitte erneut versuchen.',
    },
  },
  pt: {
    inStock: 'Em stock',
    units: 'unidades',
    low: 'Stock baixo',
    alertAt: 'Alerta a partir de',
    alertHint: (n: number) => `Vazio: ${n}, o valor das definições.`,
    saveAlert: 'Guardar alerta',
    adjust: 'Corrigir stock',
    qty: 'Quantidade (+ acrescenta, − retira)',
    reason: 'Motivo',
    note: 'Explique (pelo menos 3 caracteres)',
    confirm: 'Guardar correção',
    cancel: 'Cancelar',
    saved: 'Guardado.',
    history: 'Histórico de stock',
    empty: 'Ainda sem movimentos.',
    when: 'Data',
    type: 'Tipo',
    quantity: 'Quantidade',
    box: 'Caixa',
    why: 'Motivo',
    by: 'Por',
    source: 'Origem',
    count: 'Inventário',
    page: (p: number, n: number) => `Página ${p} de ${n}`,
    errors: {
      OUT_OF_STOCK: 'Stock insuficiente para retirar esta quantidade.',
      VALIDATION: 'Verifique a quantidade e o motivo.',
      FORBIDDEN: 'O seu perfil não pode corrigir o stock.',
      other: 'Não foi possível guardar. Tente de novo.',
    },
  },
};

const DATE_TAGS: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', pt: 'pt-PT' };

type Movement = {
  id: string;
  createdAt: string;
  type: string;
  qty: number;
  unitQty?: number | null;
  reason?: string | null;
  unit?: { label?: string } | string | null;
  user?: { name?: string } | string | null;
  ref?: { relationTo: string; value: { id: string } | string } | null;
};
type Page = { docs: Movement[]; page: number; totalPages: number };

const useLang = (): Lang => {
  const { i18n } = useTranslation();
  return (i18n.language in TEXT ? i18n.language : 'fr') as Lang;
};

async function fetchStock(variant: string, lang: Lang, page: number) {
  const where = `where[variant][equals]=${encodeURIComponent(variant)}`;
  const [movements, levels] = await Promise.all([
    fetch(`/api/stockMovements?${where}&sort=-createdAt&limit=10&page=${page}&depth=1&locale=${lang}`, { credentials: 'include' }).then((r) => r.json() as Promise<Page>),
    fetch(`/api/stockLevels?${where}&limit=1&depth=0`, { credentials: 'include' }).then((r) => r.json() as Promise<{ docs?: { onHand: number; lowStock?: boolean | null }[] }>),
  ]);
  return { movements, level: levels.docs?.[0] };
}

const errorText = (t: (typeof TEXT)['fr'], code: string) => t.errors[code as keyof typeof t.errors] ?? t.errors.other;

const noEnter = (e: KeyboardEvent) => {
  // These inputs sit inside Payload's document form: Enter must not save the whole document.
  if (e.key === 'Enter') e.preventDefault();
};

export default function AdjustButton(props: {
  variant: string;
  onHand: number;
  lowStock: boolean;
  threshold: number | null;
  defaultThreshold: number;
  staffNames: Record<string, string>;
}) {
  const { variant, defaultThreshold, staffNames } = props;
  const lang = useLang();
  const t = TEXT[lang];
  const [level, setLevel] = useState({ onHand: props.onHand, lowStock: props.lowStock });
  const [threshold, setThreshold] = useState(props.threshold === null ? '' : String(props.threshold));
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<(typeof ADJUST_REASONS)[number]>('breakage');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<Page | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    void fetchStock(variant, lang, page).then(({ movements, level: row }) => {
      if (!current) return;
      setHistory(movements);
      if (row) setLevel({ onHand: row.onHand, lowStock: Boolean(row.lowStock) });
    });
    return () => {
      current = false;
    };
  }, [variant, lang, page, version]);

  async function run(result: Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setBusy(true);
    try {
      const res = await result;
      if (!res.ok) {
        toast.error(errorText(t, res.error ?? ''));
        return;
      }
      toast.success(t.saved);
      after();
      setPage(1);
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  const saveAlert = () => run(setLowStockAlert(null, { variant, threshold: threshold.trim() }), () => {});
  const saveAdjust = () =>
    run(adjustStock(null, { variant, qty: qty.trim(), reason, note }), () => {
      setOpen(false);
      setQty('');
      setNote('');
    });
  const dateFmt = new Intl.DateTimeFormat(DATE_TAGS[lang], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });

  return (
    <div className="gg-stock">
      <div className="gg-stock__head">
        <div className="gg-stock__level">
          <span className="gg-stock__label">{t.inStock}</span>
          <strong>
            {level.onHand} <small>{t.units}</small>
          </strong>
          {level.lowStock && <span className="gg-badge gg-badge--warning">{t.low}</span>}
        </div>
        <div className="gg-stock__alert">
          <label>
            <span className="gg-stock__label">{t.alertAt}</span>
            <input type="number" min={0} inputMode="numeric" value={threshold} placeholder={String(defaultThreshold)} onChange={(e) => setThreshold(e.target.value)} onKeyDown={noEnter} />
          </label>
          <button type="button" className="gg-btn" disabled={busy} onClick={saveAlert}>
            {t.saveAlert}
          </button>
          <p className="gg-stock__hint">{t.alertHint(defaultThreshold)}</p>
        </div>
      </div>

      {open ? (
        <div className="gg-stock__form">
          <label>
            <span className="gg-stock__label">{t.qty}</span>
            <input type="number" step={1} inputMode="numeric" value={qty} placeholder="-2" autoFocus onChange={(e) => setQty(e.target.value)} onKeyDown={noEnter} />
          </label>
          <label>
            <span className="gg-stock__label">{t.reason}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value as (typeof ADJUST_REASONS)[number])}>
              {ADJUST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {pick(REASON_LABELS[r], lang)}
                </option>
              ))}
            </select>
          </label>
          {reason === 'other' && (
            <label className="gg-stock__wide">
              <span className="gg-stock__label">{t.note}</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={noEnter} />
            </label>
          )}
          <div className="gg-stock__actions">
            <button type="button" className="gg-btn gg-btn--primary" disabled={busy || !qty.trim() || Number(qty) === 0} onClick={saveAdjust}>
              {t.confirm}
            </button>
            <button type="button" className="gg-btn" disabled={busy} onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="gg-btn gg-btn--primary" onClick={() => setOpen(true)}>
          <PackageMinus />
          <span>{t.adjust}</span>
        </button>
      )}

      <h3 className="gg-stock__title">{t.history}</h3>
      {history && history.docs.length === 0 ? (
        <p className="gg-stock__hint">{t.empty}</p>
      ) : (
        <div className="gg-stock__table">
          <table>
            <thead>
              <tr>
                <th>{t.when}</th>
                <th>{t.type}</th>
                <th>{t.quantity}</th>
                <th>{t.box}</th>
                <th>{t.why}</th>
                <th>{t.by}</th>
                <th>{t.source}</th>
              </tr>
            </thead>
            <tbody>
              {history?.docs.map((m) => {
                const refId = m.ref ? (typeof m.ref.value === 'object' ? m.ref.value.id : m.ref.value) : null;
                return (
                  <tr key={m.id}>
                    <td>{dateFmt.format(new Date(m.createdAt))}</td>
                    <td>{pick(TYPE_LABELS[m.type], lang) ?? m.type}</td>
                    <td className={m.qty < 0 ? 'gg-stock__minus' : 'gg-stock__plus'}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td>{typeof m.unit === 'object' && m.unit ? `${m.unitQty ?? ''} × ${m.unit.label ?? ''}` : ''}</td>
                    <td>{m.reason ? (pick(REASON_LABELS[m.reason], lang) ?? m.reason) : ''}</td>
                    <td>{typeof m.user === 'object' && m.user ? m.user.name : m.user ? (staffNames[m.user] ?? '') : ''}</td>
                    <td>{refId && m.ref?.relationTo === 'stockCounts' ? <a href={`/admin/collections/stockCounts/${refId}`}>{t.count}</a> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {history && history.totalPages > 1 && (
        <div className="gg-stock__pages">
          <button type="button" className="gg-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="‹">
            <ChevronLeft />
          </button>
          <span>{t.page(history.page, history.totalPages)}</span>
          <button type="button" className="gg-btn" disabled={page >= history.totalPages} onClick={() => setPage(page + 1)} aria-label="›">
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
