import type { UIFieldServerProps } from 'payload';
import DecisionBar, { type Decision } from '@/components/admin/decision-bar';
import { DocCard, DocFacts, DocGrid, DocHead, DocHistory, DocPanel } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { slotLabel } from '@/lib/time';
import { decideReservation } from '../actions';
import { ORDER_STATUS_LABELS, RESERVATION_STATUS_LABELS, RESERVATION_STATUS_TONES } from '../collections';
import { type OrderStatus, RESERVATION_FLOW, type ReservationStatus } from '../order-states';
import { langOf, salesText } from './text';

// A table reservation's edit view (ui field `panel`): status and the decisions RESERVATION_FLOW allows, the guests'
// details, the pre-order with its total, and the history.

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
  const decisions: Decision[] = hasRole(user, ['sales'])
    ? (RESERVATION_FLOW[status] as readonly ReservationStatus[]).map((to) => {
        const tone = to === 'rejected' || to === 'cancelled' || to === 'no_show' ? ('danger' as const) : ('primary' as const);
        // A reason is kept in the history when the visit does not happen (GG-019); optional.
        return { to, ...t.reservations[to as keyof typeof t.reservations], tone, reason: tone === 'danger' };
      })
    : [];

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
