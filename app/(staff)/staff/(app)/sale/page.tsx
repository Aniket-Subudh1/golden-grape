import type { Metadata } from 'next';
import { SaleScreen } from '@/components/staff/sale-screen';
import { StaffPage } from '@/components/staff/page';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Vente' };

/** The mobile sale (M3.1 T5); `?add=<variant>&unit=<unit>` starts it with one item (the scan screen's "Vendre"). */
export default async function SalePage({ searchParams }: PageProps<'/staff/sale'>) {
  const { locale, t, dict } = await requireStaff('sale');
  const { add, unit } = await searchParams;
  const initial =
    typeof add === 'string' && add
      ? [{ variant: add, unit: typeof unit === 'string' && unit ? unit : undefined, qty: 1 }]
      : [];
  return (
    <StaffPage width="wide" title={t.sale.title} back={{ href: '/staff', label: t.back }}>
      <SaleScreen
        locale={locale}
        initial={initial}
        t={{ ...t.sale, scan: t.scan, search: t.customers.search, form: t.customers.form, badges: t.customers, extras: dict.cart.extras }}
        messages={{ error: dict.form.error, fields: { ...dict.form.fields, ...dict.auth.errors } }}
      />
    </StaffPage>
  );
}
