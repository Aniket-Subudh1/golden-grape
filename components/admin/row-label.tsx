'use client';

import { useRowLabel } from '@payloadcms/ui';

/** Array rows titled by their content ("Boutique", "La Maison") instead of "Nav Item 01" (`admin.components.RowLabel`). */
export default function RowLabel() {
  const { data, rowNumber = 0 } = useRowLabel<{ label?: string; title?: string }>();
  return <span>{data?.label || data?.title || `Row ${rowNumber + 1}`}</span>;
}
