'use client';

import { useTranslation } from '@payloadcms/ui';
import { getTranslation } from '@payloadcms/translations';
import type { DefaultCellComponentProps } from 'payload';

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

/** A signed quantity: +12 in green, −3 in red. */
export function SignedCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== 'number') return null;
  return <span className={`gg-qty ${cellData < 0 ? 'gg-qty--out' : 'gg-qty--in'}`}>{cellData > 0 ? `+${cellData}` : cellData < 0 ? `−${-cellData}` : '0'}</span>;
}
