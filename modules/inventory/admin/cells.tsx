'use client';

import { useTranslation } from '@payloadcms/ui';
import type { DefaultCellComponentProps } from 'payload';
import type { Label } from '@/lib/admin';
import { REASON_LABELS } from '../labels';

// Stock list cells: quantity with its low-stock badge, the alert level, the reason in words.

const TEXT = {
  fr: { units: 'unités', low: 'Stock bas', out: 'Rupture', byDefault: 'Par défaut' },
  en: { units: 'units', low: 'Low stock', out: 'Out of stock', byDefault: 'Default' },
  de: { units: 'Einheiten', low: 'Niedrig', out: 'Ausverkauft', byDefault: 'Standard' },
  pt: { units: 'unidades', low: 'Stock baixo', out: 'Esgotado', byDefault: 'Padrão' },
};
const useLang = () => {
  const { i18n } = useTranslation();
  return (i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT;
};

export function StockCell({ cellData, rowData }: DefaultCellComponentProps) {
  const t = TEXT[useLang()];
  if (typeof cellData !== 'number') return null;
  return (
    <span className="gg-offer">
      <b>
        {cellData} <small>{t.units}</small>
      </b>
      {cellData <= 0 ? <span className="gg-badge gg-badge--danger">{t.out}</span> : rowData?.lowStock ? <span className="gg-badge gg-badge--warning">{t.low}</span> : null}
    </span>
  );
}

export function ThresholdCell({ cellData }: DefaultCellComponentProps) {
  const t = TEXT[useLang()];
  return typeof cellData === 'number' ? <span>{cellData}</span> : <span className="gg-muted">{t.byDefault}</span>;
}

/** A stored reason as words: listed reasons are keys, "other" is the staff member's own text. */
export function ReasonCell({ cellData }: DefaultCellComponentProps) {
  const lang = useLang();
  if (typeof cellData !== 'string') return null;
  const label: Label | undefined = REASON_LABELS[cellData];
  return <span>{label ? (label[lang] ?? label.fr) : cellData}</span>;
}
