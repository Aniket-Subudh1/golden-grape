import type { UIFieldServerProps } from 'payload';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocHistory, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { slotLabel } from '@/lib/time';
import type { Order } from '@/payload-types';
import { transitionOrder } from '../actions';
import { MODE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../collections';
import { ORDER_FLOW, type OrderStatus } from '../order-states';
import { langOf, salesText } from './text';

// The order's edit view (ui field `panel`): status and the moves ORDER_FLOW allows, customer, slot, payment, items
// and history. Every value is read here, when the page opens; the buttons reload it after a change.

const percent = (bp: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);

/** The moves offered for an order: ORDER_FLOW, minus those that do not fit its mode. */
function decisionsFor(order: Order, t: ReturnType<typeof salesText>): Decision[] {
  const from = (order.status ?? 'pending') as OrderStatus;
  return (ORDER_FLOW[from] as readonly OrderStatus[])
    .filter((to) => !(to === 'ready' && order.mode === 'delivery') && !(to === 'out_for_delivery' && order.mode !== 'delivery'))
    .filter((to) => !(to === 'refunded' && order.payment?.status !== 'paid'))
    .map((to) => {
      const words = to === 'confirmed' && from === 'awaiting_payment' ? t.orders.paid : t.orders[to as keyof typeof t.orders];
      const tone = to === 'cancelled' || to === 'refunded' ? ('danger' as const) : ('primary' as const);
      return { to, ...words, tone, reason: tone === 'danger' };
    })
    // The main next step first, the way back last.
    .sort((a, b) => Number(a.tone === 'danger') - Number(b.tone === 'danger'));
}

export default async function OrderPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const order = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!order) return null;
  const lang = langOf(i18n.language);
  const t = salesText(lang);
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, lang);
  const status = (order.status ?? 'pending') as OrderStatus;

  const [reservation, staff, customer] = await Promise.all([
    order.mode === 'table'
      ? payload.find({ collection: 'reservations', where: { preorder: { equals: order.id } }, limit: 1, depth: 0, overrideAccess: true }).then((r) => r.docs[0] ?? null)
      : null,
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true, select: { name: true } }),
    order.customer ? payload.findByID({ collection: 'customers', id: String(order.customer), depth: 0, overrideAccess: true, disableErrors: true, select: { name: true } }) : null,
  ]);
  const staffName = new Map(staff.docs.map((u) => [u.id, u.name]));
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const decisions = reservation || !hasRole(user, ['sales']) ? [] : decisionsFor(order, t);
  const totals = order.totals;
  const address = order.address;

  return (
    <DocPanel>
      <DocHead
        badge={<span className={`gg-badge gg-badge--${ORDER_STATUS_TONES[status]}`}>{ORDER_STATUS_LABELS[status][lang]}</span>}
        title={`${MODE_LABELS[order.mode ?? 'pickup'][lang]} · ${slotLabel(order.slot ?? {}, lang)}`}
        sub={`${order.contact?.name ?? ''} · ${money(totals?.totalCents)}`}
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
              [t.when, slotLabel(order.slot ?? {}, lang)],
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
              ...(order.payment?.method === 'transfer' ? [[t.reference, order.number] as [string, string | null | undefined]] : []),
            ]}
          />
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

        <DocCard title={t.history} wide>
          <DocHistory
            empty={t.noHistory}
            rows={[
              { when: when.format(new Date(order.createdAt)), text: t.placed },
              ...(order.history ?? []).map((h) => ({
                when: h.at ? when.format(new Date(h.at)) : '',
                text: ORDER_STATUS_LABELS[(h.to ?? 'pending') as OrderStatus]?.[lang] ?? h.to,
                by: h.user ? staffName.get(String(h.user)) : null,
                note: h.reason,
              })),
            ]}
          />
        </DocCard>
      </DocGrid>
    </DocPanel>
  );
}
