'use client';

import { toast } from '@payloadcms/ui';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { refreshReviewsAction } from '../actions';

export function RefreshReviews({ label, done, failed }: { label: string; done: string; failed: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="gg-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await refreshReviewsAction(null, {});
        setBusy(false);
        if (!res.ok || !res.data.ok) return void toast.error(`${failed}${res.ok && 'reason' in res.data ? ` (${res.data.reason})` : ''}`);
        toast.success(done);
        window.location.reload();
      }}
    >
      <RefreshCw />
      <span>{label}</span>
    </button>
  );
}
