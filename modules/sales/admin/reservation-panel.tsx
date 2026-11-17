import type { DefaultServerCellComponentProps, UIFieldServerProps } from 'payload';
import DecisionBar from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocHistory, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { slotLabel, today } from '@/lib/time';
import { decideReservation } from '../actions';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type PaymentStatus, RESERVATION_STATUS_LABELS, RESERVATION_STATUS_TONES } from '../collections';
import { ORDER_ROLES, type OrderStatus, type ReservationStatus } from '../order-states';
import { reservationDecisions } from './decisions';
import { langOf, salesText } from './text';

// A table reservation's edit view (ui field `panel`): status and the decisions RESERVATION_FLOW allows, the guests'
// details, the pre-order with its total, and the history. The list's attendance buttons (AttendanceCell below) offer
// the same moves with the same dialogs.

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
  const decisions = hasRole(user, ORDER_ROLES) ? reservationDecisions(status, preorder, lang) : [];

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
                // Paid or not, apart from the visit ("Encaisser", APPLUX 15 Nov).
                [t.payment, PAYMENT_STATUS_LABELS[(preorder.payment?.status ?? 'none') as PaymentStatus][lang]],
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
 * The reservations list's attendance buttons (QA 12 Nov GG-05, 14 Nov GG-23, APPLUX 15 Nov), so staff never have to
 * open the reservation: on an accepted reservation whose day has come, "Client arrivé" (one click), "Encaisser" while
 * its pre-order owes money and "Client absent"; once the guests came, "Encaisser" until the pre-order is paid. The
 * dialogs open above the list. The actions themselves are refused to roles other than sales.
 */
export async function AttendanceCell({ rowData, payload, i18n }: DefaultServerCellComponentProps) {
  const row = rowData as { id?: string; status?: string; slot?: { date?: string | null } | null; preorder?: string | { id: string } | null };
  const arriving = row?.status === 'accepted' && !!row.slot?.date && row.slot.date <= today();
  const preorderId = typeof row?.preorder === 'object' ? row.preorder?.id : row?.preorder;
  if (!row?.id || !(arriving || (row.status === 'completed' && preorderId))) return null;
  const preorder = preorderId ? await payload.findByID({ collection: 'orders', id: preorderId, depth: 0, overrideAccess: true, disableErrors: true, select: { status: true, totals: true, payment: true } }) : null;
  const lang = langOf(i18n.language);
  const decisions = reservationDecisions(row.status as ReservationStatus, preorder, lang, ['completed', 'no_show']);
  return <DecisionBar action={decideReservation} target={{ reservation: row.id }} decisions={decisions} text={salesText(lang).decide} modal />;
}
