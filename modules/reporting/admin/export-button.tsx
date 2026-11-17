'use client';

import { toast } from '@payloadcms/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { saveFile } from '@/components/admin/save-file';
import { exportSales } from '../actions';

/** "Export CSV" on the sales dashboard: the table as shown (range, channel, grouping). */
export function ExportSales({ query, label, error }: { query: Parameters<typeof exportSales>[1]; label: string; error: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="gg-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await exportSales(null, query);
        setBusy(false);
        if (!res.ok) return void toast.error(error);
        saveFile(res.data.name, res.data.csv);
      }}
    >
      <Download />
      <span>{label}</span>
    </button>
  );
}
