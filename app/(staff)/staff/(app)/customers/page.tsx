import type { Metadata } from 'next';
import { CustomersScreen } from '@/components/staff/customers-screen';
import { TopBar } from '@/components/staff/top-bar';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Clients' };

export default async function CustomersPage() {
  const { t, dict } = await requireStaff('customers');
  return (
    <>
      <TopBar title={t.customers.title} back={{ href: '/staff', label: t.back }} />
      <main className="p-4">
        <CustomersScreen t={{ ...t.customers, newCustomer: t.sale.newCustomer }} messages={{ error: dict.form.error, fields: { ...dict.form.fields, ...dict.auth.errors } }} />
      </main>
    </>
  );
}
