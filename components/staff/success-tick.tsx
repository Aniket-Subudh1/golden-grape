'use client';

import { useEffect } from 'react';
import { celebrate } from './feedback';

/**
 * The "done" moment of a sale or a receipt: a green disc pops in, the tick draws itself, two ripples spread, and the
 * chime plays once (owner request, 17 Nov). Still for people who ask for less motion (staff.css).
 */
export function SuccessTick() {
  useEffect(() => {
    celebrate();
  }, []);
  return (
    <div className="gg-tick relative mx-auto grid h-24 w-24 place-items-center" aria-hidden>
      <span className="gg-tick__ripple absolute inset-0 rounded-full bg-emerald-400/40" />
      <span className="gg-tick__ripple gg-tick__ripple--late absolute inset-0 rounded-full bg-emerald-400/30" />
      <svg
        viewBox="0 0 52 52"
        className="gg-tick__disc relative h-24 w-24 drop-shadow-[0_8px_20px_rgb(16_185_129/0.35)]"
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
