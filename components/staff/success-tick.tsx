'use client';

import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { celebrate } from './feedback';

// Ten small pieces for the big moments only: where each flies (px) and how far it turns. Fixed, not random, so the
// burst looks the same every time and stays small.
const BURST = [
  [-58, -46, 120, '#c9a24a'],
  [-30, -70, -90, '#10b981'],
  [8, -78, 200, '#e9d7a8'],
  [44, -62, -140, '#c9a24a'],
  [68, -30, 90, '#10b981'],
  [70, 14, -60, '#e9d7a8'],
  [-70, 8, 160, '#10b981'],
  [-62, 40, -120, '#e9d7a8'],
  [54, 46, 60, '#c9a24a'],
  [-14, 66, -200, '#c9a24a'],
] as const;

/**
 * The "done" moment of a sale, a receipt or a count: a green disc pops in, the tick draws itself, one ripple spreads,
 * a small burst of gold and green flecks, and the chime plays once (owner request, 17 Nov). Still for people who ask
 * for less motion (staff.css).
 */
export function SuccessTick() {
  useEffect(() => {
    celebrate();
  }, []);
  return (
    <div className="gg-tick relative mx-auto mb-2 grid h-24 w-24 place-items-center" aria-hidden>
      <span className="gg-tick__ripple absolute inset-0 rounded-full bg-emerald-400/35" />
      {BURST.map(([x, y, r, color], i) => (
        <span
          key={i}
          className="gg-tick__fleck absolute top-1/2 left-1/2 h-2.5 w-1.5 rounded-[2px]"
          style={{ '--x': `${x}px`, '--y': `${y}px`, '--r': `${r}deg`, background: color } as CSSProperties}
        />
      ))}
      <svg
        viewBox="0 0 52 52"
        className="gg-tick__disc relative h-24 w-24 drop-shadow-[0_8px_20px_rgb(16_185_129/0.3)]"
      >
        <circle cx="26" cy="26" r="25" fill="#10b981" />
        <path
          className="gg-tick__check"
          d="M15 27.5l7.5 7.5L38 19"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** The success toasts' icon in the staff app: a small green tick that draws itself (everyday saves). */
export function ToastCheck() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#10b981" className="gg-toast-check__disc" />
      <path
        className="gg-toast-check__tick"
        d="M5.8 10.4l2.8 2.8 5.6-6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
