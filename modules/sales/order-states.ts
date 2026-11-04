// Order and reservation state machines (03 §4.6, M2.3 T3). Transitions and their side effects are data, checked in
// one place: `transition()` in service.ts refuses anything not listed and runs exactly the listed effects.

export const ORDER_STATUSES = ['pending', 'awaiting_payment', 'confirmed', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_FLOW = {
  pending: ['confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded'],
  ready: ['completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export const RESERVATION_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_FLOW = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  rejected: [],
  cancelled: [],
  completed: [],
} as const satisfies Record<ReservationStatus, readonly ReservationStatus[]>;

export type Effect = 'postSale' | 'returnStock' | 'mailCustomer' | 'mailStaff' | 'outbox';

export const canTransition = (from: OrderStatus, to: OrderStatus) => (ORDER_FLOW[from] as readonly OrderStatus[]).includes(to);
export const canTransitionReservation = (from: ReservationStatus, to: ReservationStatus) => (RESERVATION_FLOW[from] as readonly ReservationStatus[]).includes(to);

/** Goods have left the shelves (sale movements posted) in these states. */
const STOCK_OUT: OrderStatus[] = ['confirmed', 'ready', 'out_for_delivery'];
/** The customer is told about these new states (03 T7: confirmed, ready, out for delivery, cancelled, refunded). */
const TOLD: OrderStatus[] = ['confirmed', 'ready', 'out_for_delivery', 'cancelled', 'refunded'];

/** The side effects of an allowed order transition, in the order they run. */
export function effects(from: OrderStatus, to: OrderStatus): Effect[] {
  if (!canTransition(from, to)) return [];
  const list: Effect[] = [];
  if (to === 'confirmed') list.push('postSale');
  // Stock comes back only if it went out, and a completed (handed-over) order keeps it: a refund there is money only.
  if ((to === 'cancelled' || to === 'refunded') && STOCK_OUT.includes(from)) list.push('returnStock');
  if (TOLD.includes(to)) list.push('mailCustomer');
  if (to === 'confirmed' || to === 'cancelled' || to === 'refunded') list.push('outbox');
  return list;
}

export type PaymentChoice = 'onsite' | 'transfer';

/** Phase 1 (V-PAY): pay on site for pickup and tables, bank transfer for delivery and as an option for pickup. */
export const PAYMENT_CHOICES: Record<'pickup' | 'delivery' | 'table', PaymentChoice[]> = { pickup: ['onsite', 'transfer'], delivery: ['transfer'], table: ['onsite'] };
