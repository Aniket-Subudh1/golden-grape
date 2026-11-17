import type { PosConnector } from '../connector';

// No live till (Phase 1): sales come in by the daily file (Import / export › Till sales), and orders are not pushed. A
// queued event is marked sent with the note `no-pos`, so the outbox never piles up while no till is connected.
export const csvAdapter: PosConnector = {
  name: 'csv',
  pushOrder: async () => ({ ok: true, note: 'no-pos' }),
  pullSales: async () => [],
  health: async () => ({ ok: true, detail: 'No live till: sales are imported from the daily file.' }),
};
