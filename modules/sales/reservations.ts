import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import { withTx } from '@/lib/tx';
import type { Order, Reservation } from '@/payload-types';
import { canTransitionReservation, type OrderStatus, type ReservationStatus } from './order-states';
import { applyTransition, type Collected } from './service';

// Staff decisions on table reservations (M2.3 T6). The pre-order follows the reservation in the same transaction:
// accepting confirms it (sale movements posted), declining or cancelling cancels it (stock returned only if it had
// gone out), and a completed visit completes it.

const PREORDER_MOVE: Record<ReservationStatus, OrderStatus | null> = {
  pending: null,
  accepted: 'confirmed',
  rejected: 'cancelled',
  cancelled: 'cancelled',
  completed: 'completed',
  // The guests never came: the pre-order is cancelled like a cancellation (unopened goods back in stock).
  no_show: 'cancelled',
};

export type ReservationChange = { reservation: Reservation; preorder: Order | null; from: ReservationStatus };

/** `collect`: what the guests paid for their pre-order, as staff confirmed it on "Client arrivé" (GG-02). */
export function transitionReservation(
  payload: Payload,
  id: string,
  to: ReservationStatus,
  { user, reason, collect }: { user?: string; reason?: string; collect?: Collected } = {},
): Promise<ReservationChange> {
  return withTx(payload, async (tx) => {
    const reservation = await payload.findByID({ collection: 'reservations', id, depth: 0, req: tx.req, overrideAccess: true, disableErrors: true });
    if (!reservation) throw new AppError('NOT_FOUND', 'reservation');
    const from = (reservation.status ?? 'pending') as ReservationStatus;
    if (!canTransitionReservation(from, to)) throw new AppError('CONFLICT', 'transition', 'status');
    const claim = await tx.model('reservations').updateOne({ _id: id, status: from }, { $set: { status: to } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'transition', 'status');

    if (collect && (to !== 'completed' || !reservation.preorder)) throw new AppError('VALIDATION', 'amountTooHigh', 'amount');
    let preorder: Order | null = null;
    const move = PREORDER_MOVE[to];
    if (reservation.preorder && move) {
      const preorderId = typeof reservation.preorder === 'object' ? reservation.preorder.id : reservation.preorder;
      preorder = (await applyTransition(tx, preorderId, move, { user, reason, collect })).order;
    }
    const updated = await payload.update({
      collection: 'reservations',
      id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: { status: to, history: [...(reservation.history ?? []), { at: new Date().toISOString(), from, to, user, reason }] },
    });
    return { reservation: updated, preorder, from };
  });
}
