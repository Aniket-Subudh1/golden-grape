import { csvAdapter } from './adapters/csv';

// The till behind one interface (M3.3 T5, 02 §6). Phase 1 has no live connection: CashMag's sales come in as a daily
// file and nothing is pushed (the `csv` adapter). M4.2 adds the CashMag adapter here.

/** An order as queued for the till (the outbox payload). */
export type PosOrder = {
  id: string;
  number: string;
  channel: string;
  status: string;
  totalCents: number;
  lines: { variant: string; unitQty: number; baseQty: number; unitPriceCents: number; totalCents: number }[];
};

export type PushResult = { ok: true; note?: string; response?: unknown } | { ok: false; error: string; response?: unknown };

export interface PosConnector {
  name: string;
  /** Sends one queued event; a thrown error or `ok: false` is retried with backoff. */
  pushOrder(topic: string, order: PosOrder): Promise<PushResult>;
  /** Sales recorded at the till since a date (a live connector); the file adapter returns none. */
  pullSales(since: Date): Promise<unknown[]>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

/** The configured adapter. */
export const connector = (): PosConnector => csvAdapter;
