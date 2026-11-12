'use client';

import { useRowLabel, useTranslation } from '@payloadcms/ui';
import { l, type Label } from '@/lib/admin';

const ROW = l('Ligne', 'Row', 'Zeile', 'Linha');

/**
 * Array rows titled by their content ("Boutique", "La Maison", "Pain et olives") instead of "Nav Item 01"
 * (`admin.components.RowLabel`). Without any text yet: "Ligne 2" in the admin's language (GG-033).
 */
export default function RowLabel() {
  const { i18n } = useTranslation();
  const { data, rowNumber = 0 } = useRowLabel<{ label?: string; title?: string; item?: string; description?: string; holder?: string; bankName?: string }>();
  // A bank account reads "Golden Grape S.à r.l. · BCEE".
  const account = [data?.holder, data?.bankName].filter(Boolean).join(' · ');
  return <span>{data?.label || data?.title || data?.item || data?.description || account || `${ROW[i18n.language as keyof Label] ?? ROW.fr} ${rowNumber + 1}`}</span>;
}
