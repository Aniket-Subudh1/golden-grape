'use client';

import { useRouter } from 'next/navigation';

// The slot-day filter beside the order tabs (order-tabs.tsx). `onDay` holds `DAY` where the picked date goes.
export default function OrderDay({ day, label, clear, anyDay, onDay }: { day: string; label: string; clear: string; anyDay: string; onDay: string }) {
  const router = useRouter();
  return (
    <span className="gg-tabs__day">
      <label>
        <span>{label}</span>
        <input type="date" value={day} onChange={(e) => router.push(e.target.value ? onDay.replace('DAY', e.target.value) : anyDay)} />
      </label>
      {day && (
        <button type="button" onClick={() => router.push(anyDay)}>
          {clear}
        </button>
      )}
    </span>
  );
}
