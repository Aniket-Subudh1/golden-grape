import type { Metadata } from 'next';
import { CustomersScreen } from '@/components/staff/customers-screen';
import { StaffPage } from '@/components/staff/page';
import { getPayloadClient } from '@/lib/payload';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Clients' };

/** Customers (M3.1 T5): the 20 most recent until a search is typed; a new one in a pop-up. */
export default async function CustomersPage() {
  const { t, dict } = await requireStaff('customers');
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'customers',
    sort: '-createdAt',
    limit: 20,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });
  const recent = docs.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company ?? null,
    phone: c.phone ?? null,
    email: c.email,
    type: c.type ?? 'private',
  }));
  return (
    <StaffPage title={t.customers.title} back={{ href: '/staff', label: t.back }} width="wide">
      <CustomersScreen
        recent={recent}
        t={{ ...t.customers, newCustomer: t.sale.newCustomer, cancel: t.sale.cancel }}
        messages={{ error: dict.form.error, fields: { ...dict.form.fields, ...dict.auth.errors } }}
      />
    </StaffPage>
  );
}
