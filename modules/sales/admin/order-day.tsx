'use client';

import { useRouter } from 'next/navigation';
import { fullLoad } from '@/components/admin/list-link';

// The slot-day filter beside the order tabs (order-tabs.tsx). `onDay` holds `DAY` where the picked date goes.
export default function OrderDay({ day, label, clear, anyDay, onDay }: { day: string; label: string; clear: string; anyDay: string; onDay: string }) {
  const router = useRouter();
  // "Tous les jours" on "Toutes" is a list with no condition: a full load (list-link.tsx).
  const go = (href: string) => (fullLoad(href) ? window.location.assign(href) : router.push(href));
  return (
    <span className="gg-tabs__day">
      <label>
        <span>{label}</span>
        <input type="date" value={day} onChange={(e) => go(e.target.value ? onDay.replace('DAY', e.target.value) : anyDay)} />
      </label>
      {day && (
        <button type="button" onClick={() => go(anyDay)}>
          {clear}
        </button>
      )}
    </span>
  );
}
