'use client';

import { useConfig, useTranslation } from '@payloadcms/ui';
import { getTranslation } from '@payloadcms/translations';
import type { DefaultCellComponentProps } from 'payload';
import { yesNo } from '@/lib/admin';

// List cells shared by the admin collections: a coloured badge for a status, a signed quantity.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A select value as a coloured badge, labelled with the field's own option label. Wired with `badgeCell()`. */
export function BadgeCell({ cellData, field, tones }: DefaultCellComponentProps & { tones: Record<string, Tone> }) {
  const { i18n } = useTranslation();
  if (typeof cellData !== 'string') return null;
  const options = 'options' in field && Array.isArray(field.options) ? field.options : [];
  const option = options.find((o) => (typeof o === 'string' ? o : o.value) === cellData);
  const label = option && typeof option === 'object' ? getTranslation(option.label as never, i18n) : cellData;
  return <span className={`gg-badge gg-badge--${tones[cellData] ?? 'neutral'}`}>{String(label)}</span>;
}

/** A checkbox in list columns: "Oui" / "Non" in the admin's language, never Payload's raw "vrai" (APPLUX audit 10 Nov, §11). */
export function BoolCell({ cellData, yesTone = 'success' }: DefaultCellComponentProps & { yesTone?: Tone }) {
  const { i18n } = useTranslation();
  return <span className={`gg-badge gg-badge--${cellData ? yesTone : 'neutral'}`}>{yesNo(i18n.language, cellData)}</span>;
}

/** A signed quantity: +12 in green, −3 in red. */
export function SignedCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== 'number') return null;
  return <span className={`gg-qty ${cellData < 0 ? 'gg-qty--out' : 'gg-qty--in'}`}>{cellData > 0 ? `+${cellData}` : cellData < 0 ? `−${-cellData}` : '0'}</span>;
}

/** The row's title as a link to its full page (join tables open a dialog by default; these collections use pages). */
export function PageLinkCell({ cellData, rowData, collectionSlug }: DefaultCellComponentProps) {
  const id = (rowData as { id?: string } | undefined)?.id;
  if (!id) return <span>{String(cellData ?? '')}</span>;
  return (
    <a className="gg-cell-link" href={`/admin/collections/${collectionSlug}/${id}`}>
      {String(cellData ?? '—')}
    </a>
  );
}

/** A collection or global slug ("eventBookings") as its name in the admin language ("Places d’événements"). */
export function CollectionCell({ cellData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const { config } = useConfig();
  if (typeof cellData !== 'string') return null;
  const collection = config.collections.find((c) => c.slug === cellData);
  const global = config.globals.find((g) => g.slug === cellData);
  const label = collection?.labels?.plural ?? global?.label;
  return <span>{label ? String(getTranslation(label as never, i18n)) : cellData}</span>;
}
