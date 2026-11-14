import type { DefaultServerCellComponentProps, UIFieldServerProps } from 'payload';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocHistory, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { slotLabel, today } from '@/lib/time';
import type { Order } from '@/payload-types';
import { dueOf } from '@/modules/payments/service';
import { decideReservation } from '../actions';
import { ORDER_STATUS_LABELS, RESERVATION_STATUS_LABELS, RESERVATION_STATUS_TONES } from '../collections';
import { type OrderStatus, RESERVATION_FLOW, type ReservationStatus } from '../order-states';
import { collectFields } from './order-panel';
import { type Lang, langOf, salesText } from './text';

// A table reservation's edit view (ui field `panel`): status and the decisions RESERVATION_FLOW allows, the guests'
// details, the pre-order with its total, and the history. The list's "Client arrivé" / "Client absent" (AttendanceCell
// below) offer the same moves with the same dialog.

type Preorder = Pick<Order, 'status' | 'totals' | 'payment'> | null;

/**
 * The moves RESERVATION_FLOW allows from `status` (or only those of `only`), worded for staff. "Client arrivé" with a
 * pre-order still owing money asks what the guests paid for it (GG-02); a visit that does not happen takes an optional
 * reason, kept in the history (GG-019).
 */
export function reservationDecisions(status: ReservationStatus, preorder: Preorder, lang: Lang, only?: ReservationStatus[]): Decision[] {
  const t = salesText(lang);
  const preorderDue = preorder && preorder.status !== 'cancelled' ? dueOf({ totalCents: preorder.totals?.totalCents ?? 0, paidCents: preorder.payment?.paidCents ?? 0, refundedCents: 0, refundDueCents: 0 }) : 0;
  return (RESERVATION_FLOW[status] as readonly ReservationStatus[])
    .filter((to) => !only || only.includes(to))
    .map((to) => {
      const tone = to === 'rejected' || to === 'cancelled' || to === 'no_show' ? ('danger' as const) : ('primary' as const);
      const words = t.reservations[to as keyof typeof t.reservations];
      if (to === 'completed' && preorderDue > 0) return { to, ...words, hint: `${words.hint} ${t.collect.preorder(formatMoney(preorderDue, lang))}`, tone, fields: collectFields(t, preorderDue, preorder?.payment?.method) };
      return { to, ...words, tone, reason: tone === 'danger' };
    });
}

export default async function ReservationPanel({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const reservation = await payload.findByID({ collection: 'reservations', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!reservation) return null;
  const lang = langOf(i18n.language);
  const t = salesText(lang);
  const status = (reservation.status ?? 'pending') as ReservationStatus;
  const [preorder, staff, customer] = await Promise.all([
    reservation.preorder ? payload.findByID({ collection: 'orders', id: String(reservation.preorder), depth: 0, overrideAccess: true, disableErrors: true }) : null,
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true, select: { name: true } }),
    reservation.customer ? payload.findByID({ collection: 'customers', id: String(reservation.customer), depth: 0, overrideAccess: true, disableErrors: true, select: { name: true } }) : null,
  ]);
  const staffName = new Map(staff.docs.map((u) => [u.id, u.name]));
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, lang);
  const decisions = hasRole(user, ['sales']) ? reservationDecisions(status, preorder, lang) : [];

  return (
    <DocPanel>
      <DocHead
        badge={<span className={`gg-badge gg-badge--${RESERVATION_STATUS_TONES[status]}`}>{RESERVATION_STATUS_LABELS[status][lang]}</span>}
        title={`${slotLabel({ date: reservation.slot?.date, from: reservation.slot?.from }, lang)} · ${reservation.guests} ${t.guests.toLowerCase()}`}
        sub={`${reservation.contact?.name ?? ''}${preorder ? ` · ${t.preorder} ${money(preorder.totals?.totalCents)}` : ''}`}
      >
        {decisions.length > 0 ? (
          <DecisionBar action={decideReservation} target={{ reservation: reservation.id }} decisions={decisions} text={t.decide} />
        ) : (
          <p className="gg-doc__muted">{t.doneReservation}</p>
        )}
      </DocHead>

      <DocGrid>
        <DocCard title={t.customer}>
          <DocFacts
            rows={[
              [t.customer, reservation.contact?.name],
              ['E-mail', reservation.contact?.email ? <a href={`mailto:${reservation.contact.email}`}>{reservation.contact.email}</a> : '—'],
              ['Tel.', reservation.contact?.phone ? <a href={`tel:${reservation.contact.phone.replace(/\s/g, '')}`}>{reservation.contact.phone}</a> : '—'],
              [t.account, customer ? <a href={`/admin/collections/customers/${customer.id}`}>{customer.name}</a> : t.guest],
              [t.language, LOCALE_NAMES[(reservation.locale ?? 'fr') as Locale]],
            ]}
          />
        </DocCard>
        <DocCard title={t.when}>
          <DocFacts
            rows={[
              [t.when, slotLabel({ date: reservation.slot?.date, from: reservation.slot?.from }, lang)],
              [t.guests, reservation.guests],
            ]}
          />
        </DocCard>
        <DocCard title={t.preorder}>
          {preorder ? (
            <DocFacts
              rows={[
                [t.total, <b key="total">{money(preorder.totals?.totalCents)}</b>],
                [t.state, ORDER_STATUS_LABELS[(preorder.status ?? 'pending') as OrderStatus][lang]],
                [t.stock, preorder.stockPosted ? t.stockOut : t.stockNot],
                ['', <a key="open" href={`/admin/collections/orders/${preorder.id}`}>{t.openPreorder} {preorder.number}</a>],
              ]}
            />
          ) : (
            <p className="gg-doc__muted">{t.noPreorder}</p>
          )}
        </DocCard>

        {preorder && (preorder.lines ?? []).length > 0 && (
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
                {(preorder.lines ?? []).map((l) => (
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
                <tr className="gg-doc__total">
                  <td colSpan={3}>{t.total}</td>
                  <td>{money(preorder.totals?.totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </DocCard>
        )}

        {reservation.notes && (
          <DocCard title={t.message} wide>
            <p className="gg-doc__note">{reservation.notes}</p>
          </DocCard>
        )}

        <DocCard title={t.history} wide>
          <DocHistory
            empty={t.noHistory}
            rows={[
              { when: when.format(new Date(reservation.createdAt)), text: t.requested },
              ...(reservation.history ?? []).map((h) => ({
                when: h.at ? when.format(new Date(h.at)) : '',
                text: RESERVATION_STATUS_LABELS[(h.to ?? 'pending') as ReservationStatus]?.[lang] ?? h.to,
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

/**
 * "Client arrivé" / "Client absent" in the reservations list (QA 12 Nov GG-05, 14 Nov GG-23): on an accepted
 * reservation whose day has come, the page's two moves in a dialog, so staff never have to open the reservation, a
 * pre-order included (its dialog asks what was paid). The action itself is refused to roles other than sales.
 */
export async function AttendanceCell({ rowData, payload, i18n }: DefaultServerCellComponentProps) {
  const row = rowData as { id?: string; status?: string; slot?: { date?: string | null } | null; preorder?: string | { id: string } | null };
  if (!row?.id || row.status !== 'accepted' || !row.slot?.date || row.slot.date > today()) return null;
  const preorderId = typeof row.preorder === 'object' ? row.preorder?.id : row.preorder;
  const preorder = preorderId ? await payload.findByID({ collection: 'orders', id: preorderId, depth: 0, overrideAccess: true, disableErrors: true, select: { status: true, totals: true, payment: true } }) : null;
  const lang = langOf(i18n.language);
  return <DecisionBar action={decideReservation} target={{ reservation: row.id }} decisions={reservationDecisions('accepted', preorder, lang, ['completed', 'no_show'])} text={salesText(lang).decide} modal />;
}
