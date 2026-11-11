'use client';

import { useTranslation } from '@payloadcms/ui';
import type { DefaultCellComponentProps } from 'payload';
import { formatMoney } from '@/lib/money';

/** A quotation's total incl. VAT in its list column (the `totals` group). */
export function TotalCell({ cellData }: DefaultCellComponentProps) {
  const { i18n } = useTranslation();
  const cents = (cellData as { totalCents?: number } | null)?.totalCents;
  return <span className="gg-qty">{typeof cents === 'number' ? formatMoney(cents, i18n.language) : '—'}</span>;
}
