import type { Tx } from '@/lib/tx';
import type { Order } from '@/payload-types';
import { manual } from './providers/manual';

// How an order is paid (V-PAY). Phase 1 has only `manual` (on site, transfer, invoice); wallee (M4.1) implements the
// same interface. Every call runs in the caller's transaction, so a payment row exists only if the order change does.

export type PaymentMethod = 'onsite' | 'transfer' | 'invoice' | 'card';
export type StartResult = { status: 'confirmed' | 'awaiting_payment'; paymentStatus: 'pending' | 'authorized' | 'paid'; redirectUrl?: string };

/** Money that really moved, as staff recorded it (GG-003/004): amount, the bank's date, its reference, who noted it. */
export type Movement = { amountCents: number; at: Date; method?: string; reference?: string; reason?: string; user?: string };

export type PaymentProvider = {
  start(tx: Tx, order: Order): Promise<StartResult>;
  capture(tx: Tx, order: Order, money: Movement): Promise<void>;
  void(tx: Tx, order: Order, user?: string): Promise<void>;
  refund(tx: Tx, order: Order, money: Movement): Promise<void>;
};

const PROVIDERS = { manual } satisfies Record<string, PaymentProvider>;

export const provider = (name: string | null | undefined): PaymentProvider => PROVIDERS[(name ?? 'manual') as keyof typeof PROVIDERS] ?? manual;
