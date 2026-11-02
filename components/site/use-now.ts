'use client';

import { useSyncExternalStore } from 'react';

// A clock in whole seconds. `undefined` on the server, so a prerender never bakes in a stale time.
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000) * 1000;
const noTime = () => undefined;

export const useNow = () => useSyncExternalStore(subscribe, nowSeconds, noTime);
