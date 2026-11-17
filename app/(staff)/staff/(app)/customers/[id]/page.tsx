import { Building2, FileText, Mail, MapPin, Phone, Receipt, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CustomerEdit, CustomerRow } from '@/components/staff/customers-screen';
import { StaffDecisions } from '@/components/staff/decisions';
import { StaffPage } from '@/components/staff/page';
import { Empty } from '@/components/staff/tabs';
import { interpolate } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { slotLabel } from '@/lib/time';
import { getCustomer, hasNoEmail } from '@/modules/customers/service';
import { orderFromQuotationAction } from '@/modules/documents/actions';
import { INVOICE_STATUS, QUOTATION_STATUS } from '@/modules/documents/collections';
import { isExpired } from '@/modules/documents/service';
import { langOf, salesText } from '@/modules/sales/admin/text';
import { ORDER_STATUS_LABELS } from '@/modules/sales/collections';
import { ordersOf } from '@/modules/sales/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Client' };

function Item({ icon, children, muted }: { icon: ReactNode; children: ReactNode; muted?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="text-ink/45 mt-0.5 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className={muted ? 'text-ink/50 italic' : undefined}>{children}</span>
    </li>
  );
}

/** One customer (M3.1 T5): who they are, how to reach them, their last 10 orders; edit in a pop-up. */
export default async function CustomerPage({ params }: PageProps<'/staff/customers/[id]'>) {
  const { id } = await params;
  const { locale, t, dict } = await requireStaff('customers', `/staff/customers/${id}`);
  const payload = await getPayloadClient();
  const mine = { where: { customer: { equals: id } }, sort: '-createdAt', limit: 10, depth: 0, overrideAccess: true } as const;
  const [customer, orders, quotations, invoices] = await Promise.all([
    getCustomer(payload, id),
    ordersOf(payload, id, 10),
    payload.find({ collection: 'quotations', ...mine, where: { customer: { equals: id }, kind: { equals: 'b2b' }, status: { not_equals: 'draft' } } }),
    payload.find({ collection: 'invoices', ...mine }),
  ]);
  if (!customer) notFound();
  const decide = salesText(langOf(locale)).decide;
  const orderNumber = new Map(orders.map((o) => [o.id, o.number]));
  const isBusiness = customer.type === 'business';
  const noEmail = hasNoEmail(customer.email);
  const picked = {
    id: customer.id,
    name: customer.name,
    company: customer.company ?? null,
    phone: customer.phone ?? null,
    email: customer.email,
    type: customer.type ?? 'private',
  };
  return (
    <StaffPage
      title={customer.company || customer.name}
      back={{ href: '/staff/customers', label: t.back }}
      width="wide"
      action={
        <CustomerEdit
          t={{ ...t.customers.form, edit: t.customers.edit, cancel: t.sale.cancel }}
          messages={{ error: dict.form.error, fields: { ...dict.form.fields, ...dict.auth.errors } }}
          initial={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone ?? '',
            email: noEmail ? '' : customer.email,
            type: customer.type ?? 'private',
            company: customer.company ?? '',
            vatNumber: customer.vatNumber ?? '',
            locale: customer.locale ?? 'fr',
          }}
        />
      }
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8"
    >
      <section className="gg-card p-4 text-sm md:p-5">
        <CustomerRow c={picked} t={t.customers} />
        <ul className="divide-border mt-3 divide-y border-t">
          {customer.company && <Item icon={<Building2 />}>{customer.name}</Item>}
          <Item icon={<Phone />}>{customer.phone || '—'}</Item>
          <Item icon={<Mail />} muted={noEmail}>
            {noEmail ? t.customers.noEmail : customer.email}
          </Item>
          {customer.vatNumber && <Item icon={<Receipt />}>{customer.vatNumber}</Item>}
          {(customer.addresses ?? []).map((a) => (
            <Item key={a.id} icon={<MapPin />}>
              {a.line1}
              {a.line2 && `, ${a.line2}`}, {a.postalCode} {a.city}
            </Item>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="eyebrow text-ink/55 mb-2">{t.customers.orders}</h2>
        {orders.length === 0 ? (
          <Empty icon={<ShoppingBag />} text={t.customers.noOrders} />
        ) : (
          <ul className="divide-border gg-card divide-y">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">{o.number}</span>
                  <span className="text-ink/55 text-xs">{slotLabel(o.slot ?? {}, locale, 'short')}</span>
                </span>
                <span className="text-right">
                  <span className="block font-medium tabular-nums">
                    {formatMoney(o.totals?.totalCents ?? 0, locale)}
                  </span>
                  <span className="text-ink/55 text-xs">{ORDER_STATUS_LABELS[o.status ?? 'pending'][locale]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {isBusiness && (
          <>
            <h2 className="eyebrow text-ink/55 mt-6 mb-2">{t.customers.quotations}</h2>
            {quotations.docs.length === 0 ? (
              <Empty icon={<FileText />} text={t.customers.noQuotations} />
            ) : (
              <ul className="divide-border gg-card divide-y">
                {quotations.docs.map((q) => {
                  const open = !q.order && ['sent', 'viewed', 'accepted'].includes(q.status ?? '') && !isExpired(q);
                  return (
                    <li key={q.id} className="space-y-3 px-4 py-3 text-sm" data-quotation={q.number}>
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          <span className="block font-medium">{q.number}</span>
                          <span className="text-ink/55 text-xs">
                            {q.order ? interpolate(t.customers.orderOf, { number: orderNumber.get(String(q.order)) ?? '' }) : (QUOTATION_STATUS[q.status ?? 'sent']?.[locale] ?? q.status)}
                          </span>
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(q.totals?.totalCents ?? 0, locale)}</span>
                      </div>
                      {open && (
                        <StaffDecisions
                          action={orderFromQuotationAction}
                          target={{ quotation: q.id }}
                          decisions={[{ to: 'confirmed', label: t.customers.createOrder, hint: t.customers.createOrderHint, tone: 'primary' }]}
                          text={decide}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        {(isBusiness || invoices.docs.length > 0) && (
          <>
            <h2 className="eyebrow text-ink/55 mt-6 mb-2">{t.customers.invoices}</h2>
            {invoices.docs.length === 0 ? (
              <Empty icon={<Receipt />} text={t.customers.noInvoices} />
            ) : (
              <ul className="divide-border gg-card divide-y">
                {invoices.docs.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <a href={`/api/documents/${String(inv.pdf)}`} target="_blank" rel="noreferrer" className="text-gold-deep inline-flex items-center gap-1.5 font-medium hover:underline">
                      <FileText className="h-4 w-4" aria-hidden />
                      {inv.number}
                    </a>
                    <span className="text-right">
                      <span className="block font-medium tabular-nums">{formatMoney(inv.totals?.totalCents ?? 0, locale)}</span>
                      <span className="text-ink/55 text-xs">{INVOICE_STATUS[inv.status ?? 'issued']?.[locale]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </StaffPage>
  );
}
