import type { Decision, DecisionField } from '@/components/admin/decision-bar';
import { formatMoney } from '@/lib/money';
import { isBeforeSlot, today } from '@/lib/time';
import type { Order } from '@/payload-types';
import { issueDeliveryNoteAction, issueInvoiceAction } from '@/modules/documents/actions';
import { dueOf, refundableOf } from '@/modules/payments/service';
import { type BankAccount, formatIban, transferAccount } from '@/modules/settings/service';
import { changeOrderBankAccount, recordOrderPayment, recordOrderRefund, requestOrderRefund, returnOrderItems } from '../actions';
import type { returnableLines } from '../service';
import { ORDER_FLOW, type OrderStatus, RESERVATION_FLOW, type ReservationStatus } from '../order-states';
import { type Lang, salesText } from './text';

// The moves staff may make on an order or a table reservation, as data (labels, hints, fields, the action to run): the
// admin's panels and list cells render them with DecisionBar, the phone's orders screen with its own buttons
// (components/staff/decisions.tsx). One set of rules, two screens.

const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

type Text = ReturnType<typeof salesText>;

const methodOptions = (t: Text) => (['transfer', 'onsite', 'card'] as const).map((v) => ({ value: v, label: t.money.methods[v] }));

/**
 * The money taken now, on a handover or a table visit (GG-02): amount, method and day, as staff type them. The amount
 * is prefilled only when the customer was to pay on site; left empty, nothing is recorded and the balance stays due.
 */
function collectFields(t: Text, dueCents: number, method: string | null | undefined): DecisionField[] {
  const day = today();
  return [
    { name: 'amount', label: t.collect.amount, kind: 'money', value: method === 'onsite' ? euros(dueCents) : '' },
    { name: 'method', label: t.money.method, kind: 'select', value: method === 'onsite' ? 'onsite' : 'transfer', options: methodOptions(t) },
    { name: 'at', label: t.money.date, kind: 'date', value: day, max: day, required: true },
  ];
}

/** A payment received (`recordOrderPayment`): an order's "Enregistrer un paiement reçu", a reservation's "Encaisser". */
export function paymentFields(t: Text, dueCents: number, method: string | null | undefined): DecisionField[] {
  const day = today();
  return [
    { name: 'amount', label: t.money.amount, kind: 'money', value: euros(dueCents), required: true },
    { name: 'method', label: t.money.method, kind: 'select', value: method === 'onsite' ? 'onsite' : 'transfer', options: methodOptions(t) },
    { name: 'at', label: t.money.date, kind: 'date', value: day, max: day, required: true },
    { name: 'reference', label: t.money.bankRef, kind: 'text' },
  ];
}

/**
 * The moves offered for an order: ORDER_FLOW minus those that do not fit its mode ("refunded" follows the money,
 * never a button), then the money forms (GG-003/004): record a payment while something is due, ask for a refund
 * while money can go back, record the refund once one is asked for.
 */
type Returnable = Awaited<ReturnType<typeof returnableLines>>;

export function decisionsFor(order: Order, t: Text, returnable: Returnable, accounts: BankAccount[], fmt: (cents: number) => string): Decision[] {
  const from = (order.status ?? 'pending') as OrderStatus;
  const f = { totalCents: order.totals?.totalCents ?? 0, paidCents: order.payment?.paidCents ?? 0, refundedCents: order.payment?.refundedCents ?? 0, refundDueCents: order.payment?.refundDueCents ?? 0 };
  const moves: Decision[] = (ORDER_FLOW[from] as readonly OrderStatus[])
    .filter((to) => to !== 'refunded')
    .filter((to) => !(to === 'ready' && order.mode === 'delivery') && !(to === 'out_for_delivery' && order.mode !== 'delivery'))
    .map((to) => {
      const base =
        to === 'confirmed' && from === 'awaiting_payment'
          ? t.orders.paid
          : to === 'completed' && order.mode === 'delivery'
            ? t.orders.delivered
            : t.orders[to as Exclude<keyof typeof t.orders, 'delivered'>];
      const tone = to === 'cancelled' ? ('danger' as const) : from === 'awaiting_payment' ? undefined : ('primary' as const);
      // Handed over with money still due (GG-02): staff say what they took now; nothing is assumed.
      if (to === 'completed' && dueOf(f) > 0) {
        return { to, ...base, hint: `${base.hint} ${t.collect.due(fmt(dueOf(f)))}`, tone, fields: collectFields(t, dueOf(f), order.payment?.method) };
      }
      // Ready before the requested slot (GG-027): still allowed; staff are told what the customer will hear.
      const words = to === 'ready' && isBeforeSlot(order.slotAt) ? { ...base, hint: t.readyEarlyHint } : base;
      return { to, ...words, tone, reason: tone === 'danger' };
    });

  const day = today();
  const m = t.money;
  const money: Decision[] = [];
  const open = from !== 'cancelled' && from !== 'refunded';
  if (open && dueOf(f) > 0) {
    money.push({ to: 'payment', ...m.payment, tone: 'primary', action: recordOrderPayment, fields: paymentFields(t, dueOf(f), order.payment?.method) });
  }
  // Which of the shop's active accounts this transfer is paid into (APPLUX, 12 Nov; GG-01): every one of them, the
  // order's own preselected (else the default). Choosing the same one sends the details again.
  const current = order.payment?.bankAccount?.iban ?? transferAccount(accounts)?.iban;
  if (open && dueOf(f) > 0 && order.payment?.method === 'transfer' && accounts.length > 0) {
    const options = accounts.map((a) => ({ value: a.id ?? '', label: [a.holder, a.bankName, formatIban(a.iban ?? ''), a.iban === current ? `(${t.bank.current})` : ''].filter(Boolean).join(' · ') }));
    money.push({
      to: 'bank_account',
      ...t.bank,
      action: changeOrderBankAccount,
      fields: [{ name: 'account', label: t.bank.account, kind: 'select', value: accounts.find((a) => a.iban === current)?.id ?? options[0].value, options }],
    });
  }
  if (f.refundDueCents > 0) {
    money.push({
      to: 'refund',
      ...m.refund,
      tone: 'primary',
      action: recordOrderRefund,
      reason: 'required',
      reasonValue: order.payment?.refundReason ?? undefined,
      fields: [
        { name: 'amount', label: m.amount, kind: 'money', value: euros(Math.min(f.refundDueCents, refundableOf(f))), required: true },
        { name: 'at', label: m.date, kind: 'date', value: day, max: day, required: true },
        { name: 'method', label: m.method, kind: 'select', value: order.payment?.method === 'onsite' ? 'onsite' : 'transfer', options: methodOptions(t) },
        { name: 'reference', label: m.bankRef, kind: 'text' },
      ],
    });
  } else if (refundableOf(f) > 0 && from !== 'cancelled') {
    // A cancelled order's refund is asked for by the cancel itself.
    money.push({
      to: 'refund_request',
      ...m.refundRequest,
      tone: 'danger',
      action: requestOrderRefund,
      reason: 'required',
      fields: [{ name: 'amount', label: m.amount, kind: 'money', value: euros(refundableOf(f)), required: true }],
    });
  }
  // Goods brought back after the handover (GG-042): per line, at most what can still come back. No money moves.
  const left = returnable.filter((l) => l.left > 0);
  if ((from === 'completed' || from === 'refunded') && left.length > 0) {
    money.push({
      to: 'return',
      // Only the texts: a function (qtyOf) cannot be sent to the browser component.
      label: t.returns.label,
      hint: t.returns.hint,
      action: returnOrderItems,
      reason: 'required',
      fields: left.map((l) => ({ name: `line_${l.id}`, label: t.returns.qtyOf(l.detail ? `${l.name} · ${l.detail}` : l.name, l.left), kind: 'qty' as const, value: '0', max: String(l.left) })),
    });
  }
  // The main next step first, the ways back last.
  const rank = (d: Decision) => (d.tone === 'primary' ? 0 : d.tone === 'danger' ? 2 : 1);
  return [...money, ...moves].sort((a, b) => rank(a) - rank(b));
}

type Preorder = Pick<Order, 'id' | 'status' | 'totals' | 'payment'> | null;

/**
 * The moves RESERVATION_FLOW allows from `status` (or only those of `only`), worded for staff, and "Encaisser" while
 * the pre-order of an accepted or completed reservation owes money. Attendance and payment are apart (APPLUX 15 Nov):
 * "Client arrivé" is one click and records no money; "Encaisser" records what the guests paid, on the pre-order
 * (`recordOrderPayment`), before or after the arrival. A visit that does not happen takes an optional reason, kept
 * in the history (GG-019).
 */
export function reservationDecisions(status: ReservationStatus, preorder: Preorder, lang: Lang, only?: ReservationStatus[]): Decision[] {
  const t = salesText(lang);
  const moves: Decision[] = (RESERVATION_FLOW[status] as readonly ReservationStatus[])
    .filter((to) => !only || only.includes(to))
    .map((to) => {
      const tone = to === 'rejected' || to === 'cancelled' || to === 'no_show' ? ('danger' as const) : ('primary' as const);
      const words = t.reservations[to as keyof typeof t.reservations];
      return { to, ...words, tone, reason: tone === 'danger', instant: to === 'completed' };
    });
  const due = preorder && (status === 'accepted' || status === 'completed') ? dueOf({ totalCents: preorder.totals?.totalCents ?? 0, paidCents: preorder.payment?.paidCents ?? 0, refundedCents: 0, refundDueCents: 0 }) : 0;
  if (!preorder || due <= 0) return moves;
  const encash: Decision = {
    to: 'payment',
    label: t.collect.encash.label,
    hint: t.collect.encash.hint(formatMoney(due, lang)),
    action: recordOrderPayment,
    target: { order: preorder.id },
    fields: paymentFields(t, due, preorder.payment?.method),
  };
  // Client arrivé · Encaisser · Client absent / Annuler.
  return [...moves.filter((d) => d.tone !== 'danger'), encash, ...moves.filter((d) => d.tone === 'danger')];
}


const SOLD: string[] = ['confirmed', 'ready', 'out_for_delivery', 'completed'];

/** A sold order's documents still to issue (M3.2 T5): its invoice, and a delivery note when it is delivered or B2B. */
export function documentDecisions(order: Order, t: Text, has: { invoice: boolean; deliveryNote: boolean }): Decision[] {
  if (!SOLD.includes(order.status ?? '')) return [];
  return [
    ...(has.invoice ? [] : [{ to: 'invoice', label: t.docs.issueInvoice, hint: t.docs.issueInvoiceHint, action: issueInvoiceAction }]),
    ...(has.deliveryNote || (order.mode !== 'delivery' && order.mode !== 'b2b') ? [] : [{ to: 'deliveryNote', label: t.docs.issueNote, hint: t.docs.issueNoteHint, action: issueDeliveryNoteAction }]),
  ];
}
