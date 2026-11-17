import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerEdit } from '@/components/staff/customers-screen';
import { TopBar } from '@/components/staff/top-bar';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { slotLabel } from '@/lib/time';
import { getCustomer, hasNoEmail } from '@/modules/customers/service';
import { ORDER_STATUS_LABELS } from '@/modules/sales/collections';
import { ordersOf } from '@/modules/sales/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Client' };

/** One customer (M3.1 T5): contact, addresses, the last 10 orders; edit the basics. */
export default async function CustomerPage({ params }: PageProps<'/staff/customers/[id]'>) {
  const { id } = await params;
  const { locale, t, dict } = await requireStaff('customers', `/staff/customers/${id}`);
  const payload = await getPayloadClient();
  const [customer, orders] = await Promise.all([getCustomer(payload, id), ordersOf(payload, id, 10)]);
  if (!customer) notFound();
  const noEmail = hasNoEmail(customer.email);
  return (
    <>
      <TopBar title={customer.company || customer.name} back={{ href: '/staff/customers', label: t.back }} />
      <main className="space-y-4 p-4">
        <section className="rounded-xl border border-border bg-white/70 p-4 text-sm">
          {customer.company && <p className="font-serif text-xl">{customer.name}</p>}
          <p>{customer.phone}</p>
          <p className={noEmail ? 'text-ink/50 italic' : undefined}>{noEmail ? t.customers.noEmail : customer.email}</p>
          {customer.vatNumber && <p className="text-ink/60">{customer.vatNumber}</p>}
          {(customer.addresses ?? []).map((a) => (
            <p key={a.id} className="mt-2 text-ink/70">
              {a.line1}
              {a.line2 && `, ${a.line2}`}, {a.postalCode} {a.city}
            </p>
          ))}
        </section>
        <CustomerEdit
          t={{ ...t.customers.form, edit: t.customers.edit }}
          messages={{ error: dict.form.error, fields: { ...dict.form.fields, ...dict.auth.errors } }}
          initial={{ id: customer.id, name: customer.name, phone: customer.phone ?? '', email: noEmail ? '' : customer.email, type: customer.type ?? 'private', company: customer.company ?? '', vatNumber: customer.vatNumber ?? '', locale: customer.locale ?? 'fr' }}
        />
        <section>
          <h2 className="eyebrow mb-2 text-ink/60">{t.customers.orders}</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-ink/55">{t.customers.noOrders}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-white/70">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="block">{o.number}</span>
                    <span className="text-xs text-ink/55">
                      {slotLabel(o.slot ?? {}, locale, 'short')} · {ORDER_STATUS_LABELS[o.status ?? 'pending'][locale]}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(o.totals?.totalCents ?? 0, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
