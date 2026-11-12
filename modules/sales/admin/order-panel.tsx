import type { UIFieldServerProps } from 'payload';
import type { ReactNode } from 'react';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocBadge, DocCard, DocFacts, DocFigures, DocGrid, DocHead, DocHistory, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { isBeforeSlot, slotLabel, today } from '@/lib/time';
import type { Order } from '@/payload-types';
import { dueOf, paymentsOf, refundableOf } from '@/modules/payments/service';
import { activeAccounts, type BankAccount, formatIban } from '@/modules/settings/service';
import { changeOrderBankAccount, recordOrderPayment, recordOrderRefund, requestOrderRefund, returnOrderItems, transitionOrder } from '../actions';
import { orderBankAccount, returnableLines } from '../service';
import { MODE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES, type PaymentStatus, RESERVATION_STATUS_LABELS, RESERVATION_STATUS_TONES } from '../collections';
import { ORDER_FLOW, type OrderStatus } from '../order-states';
import { langOf, salesText } from './text';

// The order's edit view (ui field `panel`): status and the moves ORDER_FLOW allows, customer, slot, payment, items
// and history. Every value is read here, when the page opens; the buttons reload it after a change.

const percent = (bp: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);

const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/**
 * The moves offered for an order: ORDER_FLOW minus those that do not fit its mode ("refunded" follows the money,
 * never a button), then the money forms (GG-003/004): record a payment while something is due, ask for a refund
 * while money can go back, record the refund once one is asked for.
 */
type Returnable = Awaited<ReturnType<typeof returnableLines>>;

function decisionsFor(order: Order, t: ReturnType<typeof salesText>, returnable: Returnable, accounts: BankAccount[]): Decision[] {
  const from = (order.status ?? 'pending') as OrderStatus;
  const moves: Decision[] = (ORDER_FLOW[from] as readonly OrderStatus[])
    .filter((to) => to !== 'refunded')
    .filter((to) => !(to === 'ready' && order.mode === 'delivery') && !(to === 'out_for_delivery' && order.mode !== 'delivery'))
    .map((to) => {
      const base = to === 'confirmed' && from === 'awaiting_payment' ? t.orders.paid : t.orders[to as keyof typeof t.orders];
      // Ready before the requested slot (GG-027): still allowed; staff are told what the customer will hear.
      const words = to === 'ready' && isBeforeSlot(order.slotAt) ? { ...base, hint: t.readyEarlyHint } : base;
      const tone = to === 'cancelled' ? ('danger' as const) : from === 'awaiting_payment' ? undefined : ('primary' as const);
      return { to, ...words, tone, reason: tone === 'danger' };
    });

  const f = { totalCents: order.totals?.totalCents ?? 0, paidCents: order.payment?.paidCents ?? 0, refundedCents: order.payment?.refundedCents ?? 0, refundDueCents: order.payment?.refundDueCents ?? 0 };
  const day = today();
  const m = t.money;
  const money: Decision[] = [];
  const open = from !== 'cancelled' && from !== 'refunded';
  if (open && dueOf(f) > 0) {
    money.push({
      to: 'payment',
      ...m.payment,
      tone: 'primary',
      action: recordOrderPayment,
      fields: [
        { name: 'amount', label: m.amount, kind: 'money', value: euros(dueOf(f)), required: true },
        { name: 'at', label: m.date, kind: 'date', value: day, max: day, required: true },
        { name: 'reference', label: m.bankRef, kind: 'text' },
      ],
    });
  }
  // Another of the shop's accounts for this transfer (APPLUX, 12 Nov): offered while money is expected and there is a choice.
  const current = order.payment?.bankAccount?.iban;
  const others = accounts.filter((a) => a.iban !== current);
  if (open && dueOf(f) > 0 && order.payment?.method === 'transfer' && others.length > 0) {
    money.push({
      to: 'bank_account',
      ...t.bank,
      action: changeOrderBankAccount,
      fields: [{ name: 'account', label: t.bank.account, kind: 'select', value: others[0].id ?? '', options: others.map((a) => ({ value: a.id ?? '', label: [a.holder, a.bankName, formatIban(a.iban ?? '')].filter(Boolean).join(' · ') })) }],
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
        { name: 'method', label: m.method, kind: 'select', value: order.payment?.method === 'onsite' ? 'onsite' : 'transfer', options: (['transfer', 'onsite', 'card'] as const).map((v) => ({ value: v, label: m.methods[v] })) },
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

export default async function OrderPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const order = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!order) return null;
  const lang = langOf(i18n.language);
  const t = salesText(lang);
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, lang);
  const status = (order.status ?? 'pending') as OrderStatus;

  const [settings, reservation, staff, customer, payments] = await Promise.all([
    payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true }),
    order.mode === 'table'
      ? payload.find({ collection: 'reservations', where: { preorder: { equals: order.id } }, limit: 1, depth: 0, overrideAccess: true }).then((r) => r.docs[0] ?? null)
      : null,
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true, select: { name: true } }),
    order.customer ? payload.findByID({ collection: 'customers', id: String(order.customer), depth: 0, overrideAccess: true, disableErrors: true, select: { name: true } }) : null,
    paymentsOf(payload, order.id),
  ]);
  const day = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Europe/Luxembourg' });
  const pay = order.payment;
  const due = dueOf({ totalCents: order.totals?.totalCents ?? 0, paidCents: pay?.paidCents ?? 0, refundedCents: 0, refundDueCents: 0 });
  const staffName = new Map(staff.docs.map((u) => [u.id, u.name]));
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const returnable = order.status === 'completed' || order.status === 'refunded' ? await returnableLines(payload, order) : [];
  const account = order.payment?.method === 'transfer' ? orderBankAccount(order, settings.business?.bankAccounts) : null;
  const decisions = reservation || !hasRole(user, ['sales']) ? [] : decisionsFor(order, t, returnable, activeAccounts(settings.business?.bankAccounts));
  // When the order was made ready, if it was (kept after handover too: the history shows the whole story).
  const readyAt = [...(order.history ?? [])].reverse().find((h) => h.to === 'ready')?.at ?? null;
  const totals = order.totals;
  const address = order.address;
  const payStatus = (pay?.status ?? 'none') as PaymentStatus;
  const closed = status === 'cancelled' || status === 'refunded';
  // What staff should do now, in one sentence (APPLUX report 4, §3): a transfer to wait for, an order to prepare,
  // an order waiting for its customer are three different situations.
  const next = reservation
    ? null
    : pay?.refundDueCents
      ? t.next.refund(money(pay.refundDueCents))
      : status === 'pending'
        ? t.next.pending
        : status === 'awaiting_payment'
          ? t.next.awaiting(money(due), order.number ?? '')
          : status === 'confirmed'
            ? order.mode === 'delivery'
              ? t.next.prepareDelivery
              : t.next.prepare
            : status === 'ready'
              ? t.next.ready
              : status === 'out_for_delivery'
                ? t.next.delivering
                : null;

  return (
    <DocPanel>
      <DocHead
        badge={
          <>
            <DocBadge label={t.orderState} tone={ORDER_STATUS_TONES[status]}>
              {ORDER_STATUS_LABELS[status][lang]}
            </DocBadge>
            {payStatus !== 'none' && (
              <DocBadge label={t.payment} tone={PAYMENT_STATUS_TONES[payStatus]}>
                {PAYMENT_STATUS_LABELS[payStatus][lang]}
              </DocBadge>
            )}
            {reservation && (
              <DocBadge label={t.reservationState} tone={RESERVATION_STATUS_TONES[reservation.status ?? 'pending']}>
                {RESERVATION_STATUS_LABELS[reservation.status ?? 'pending'][lang]}
              </DocBadge>
            )}
          </>
        }
        title={`${order.number ?? ''} · ${MODE_LABELS[order.mode ?? 'pickup'][lang]} · ${slotLabel(order.slot ?? {}, lang)}`}
        sub={order.contact?.name ?? ''}
        figures={
          <DocFigures
            items={[
              { label: t.toPay, value: money(totals?.totalCents) },
              { label: t.money.paid, value: money(pay?.paidCents), tone: (pay?.paidCents ?? 0) > 0 ? 'ok' : undefined },
              { label: t.money.due, value: money(closed ? 0 : due), tone: due > 0 && !closed ? 'due' : undefined },
              ...(pay?.refundedCents ? [{ label: t.money.refunded, value: money(pay.refundedCents) }] : []),
              ...(pay?.refundDueCents ? [{ label: t.money.refundDue, value: money(pay.refundDueCents), tone: 'alert' as const }] : []),
            ]}
          />
        }
        next={
          next && (
            <>
              <strong>{t.nextStep}</strong>
              <span>
                {next}
                {(status === 'ready' || status === 'out_for_delivery') && due > 0 ? ` ${t.next.collect(money(due))}` : ''}
              </span>
            </>
          )
        }
      >
        {reservation ? (
          <div className="gg-decide gg-decide--note">
            <p>{t.followsReservation}</p>
            <a className="gg-btn" href={`/admin/collections/reservations/${reservation.id}`}>
              {t.openReservation} {reservation.number}
            </a>
          </div>
        ) : decisions.length > 0 ? (
          <DecisionBar action={transitionOrder} target={{ order: order.id }} decisions={decisions} text={t.decide} />
        ) : (
          <p className="gg-doc__muted">{t.done}</p>
        )}
      </DocHead>

      <DocGrid>
        <DocCard title={t.customer}>
          <DocFacts
            rows={[
              [t.customer, order.contact?.name],
              ['E-mail', order.contact?.email ? <a href={`mailto:${order.contact.email}`}>{order.contact.email}</a> : '—'],
              ['Tel.', order.contact?.phone ? <a href={`tel:${order.contact.phone.replace(/\s/g, '')}`}>{order.contact.phone}</a> : '—'],
              [t.account, customer ? <a href={`/admin/collections/customers/${customer.id}`}>{customer.name}</a> : t.guest],
              [t.language, LOCALE_NAMES[(order.locale ?? 'fr') as Locale]],
            ]}
          />
        </DocCard>
        <DocCard title={t.when}>
          <DocFacts
            rows={[
              [t.requestedSlot, slotLabel(order.slot ?? {}, lang)],
              ...(readyAt ? [[t.readySince, `${when.format(new Date(readyAt))}${isBeforeSlot(order.slotAt, new Date(readyAt)) ? ` · ${t.readyEarly(slotLabel(order.slot ?? {}, lang, 'short'))}` : ''}`] as [string, string]] : []),
              [
                order.mode === 'delivery' ? t.where : MODE_LABELS[order.mode ?? 'pickup'][lang],
                order.mode === 'delivery' && address ? [address.line1, address.line2, `${address.postalCode} ${address.city}`].filter(Boolean).join(', ') : t.pickupAt,
              ],
              [t.stock, order.stockPosted ? t.stockOut : t.stockNot],
            ]}
          />
        </DocCard>
        <DocCard title={t.payment}>
          <DocFacts
            rows={[
              [t.method, order.payment?.method ? PAYMENT_METHOD_LABELS[order.payment.method][lang] : '—'],
              [t.state, PAYMENT_STATUS_LABELS[order.payment?.status ?? 'none'][lang]],
              [t.total, <b key="total">{money(totals?.totalCents)}</b>],
              [t.money.paid, money(pay?.paidCents)],
              ...(due > 0 && status !== 'cancelled' ? [[t.money.due, <b key="due">{money(due)}</b>] as [string, ReactNode]] : []),
              ...(pay?.refundedCents ? [[t.money.refunded, money(pay.refundedCents)] as [string, ReactNode]] : []),
              ...(pay?.refundDueCents
                ? [[t.money.refundDue, <b key="refund" className="gg-doc__alert">{`${money(pay.refundDueCents)}${pay.refundReason ? ` — ${pay.refundReason}` : ''}`}</b>] as [string, ReactNode]]
                : []),
              ...(order.payment?.method === 'transfer'
                ? ([
                    [t.reference, order.number],
                    [t.bank.title, account?.iban ? `${[account.holder, account.bankName].filter(Boolean).join(' · ')} — ${formatIban(account.iban)}` : <span key="none" className="gg-doc__alert">{t.bank.none}</span>],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
        </DocCard>

        <DocCard title={t.money.payments} wide>
          {payments.length === 0 ? (
            <p className="gg-doc__muted">{t.money.noPayments}</p>
          ) : (
            <table className="gg-doc__lines">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {t.money.kinds[p.kind] ?? p.kind}
                      <small>
                        {[
                          p.method ? (PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]?.[lang] ?? p.method) : null,
                          p.reference,
                          p.reason ? `« ${p.reason} »` : null,
                          [p.user ? staffName.get(String(p.user)) : null, `${t.money.noted} ${when.format(new Date(p.createdAt))}`].filter(Boolean).join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </td>
                    <td>{day.format(new Date(p.at ?? p.createdAt))}</td>
                    <td>{money(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DocCard>

        <DocCard title={t.items} wide>
          <table className="gg-doc__lines">
            <thead>
              <tr>
                <th>{t.items}</th>
                <th>{t.qty}</th>
                <th>{t.unitPrice}</th>
                <th>{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {(order.lines ?? []).map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.name}
                    {l.detail && <small>{l.detail}</small>}
                  </td>
                  <td>{l.unitQty}</td>
                  <td>{money(l.unitPriceCents)}</td>
                  <td>{money(l.totalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t.subtotal}</td>
                <td>{money(totals?.subtotalCents)}</td>
              </tr>
              {Boolean(totals?.deliveryCents) && (
                <tr>
                  <td colSpan={3}>{t.delivery}</td>
                  <td>{money(totals?.deliveryCents)}</td>
                </tr>
              )}
              <tr className="gg-doc__total">
                <td colSpan={3}>{t.total}</td>
                <td>{money(totals?.totalCents)}</td>
              </tr>
              {(totals?.vatBreakdown ?? []).map((v) => (
                <tr key={v.id} className="gg-doc__vat">
                  <td colSpan={3}>{t.vat(percent(v.rateBp ?? 0, lang))}</td>
                  <td>{money(v.vatCents)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        </DocCard>

        {order.notes && (
          <DocCard title={t.message} wide>
            <p className="gg-doc__note">{order.notes}</p>
          </DocCard>
        )}

        <DocCard title={t.activity} wide>
          <DocHistory
            empty={t.noHistory}
            rows={[
              { when: when.format(new Date(order.createdAt)), text: t.placed },
              ...(order.history ?? []).map((h) => ({
                when: h.at ? when.format(new Date(h.at)) : '',
                text: ORDER_STATUS_LABELS[(h.to ?? 'pending') as OrderStatus]?.[lang] ?? t.money.history[h.to ?? ''] ?? h.to,
                by: h.user ? staffName.get(String(h.user)) : null,
                // A "ready" earlier than the requested slot says so, with the slot (GG-027).
                note: h.to === 'ready' && h.at && isBeforeSlot(order.slotAt, new Date(h.at)) ? t.readyEarly(slotLabel(order.slot ?? {}, lang, 'short')) : h.reason,
              })),
            ]}
          />
        </DocCard>
      </DocGrid>
    </DocPanel>
  );
}
