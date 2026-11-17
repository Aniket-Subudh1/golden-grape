import type { Metadata } from 'next';
import { ScanLookup } from '@/components/staff/scan-lookup';
import { StaffPage } from '@/components/staff/page';
import { hasRole } from '@/lib/access';
import { canOpen, requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Scanner' };

export default async function ScanPage() {
  const { user, locale, t } = await requireStaff('scan');
  const [adjust, count, sell] = await Promise.all([
    canOpen(user, 'stock'),
    canOpen(user, 'count'),
    canOpen(user, 'sale'),
  ]);
  return (
    <StaffPage title={t.scanPage.title} back={{ href: '/staff', label: t.back }}>
      <ScanLookup
        locale={locale}
        t={{ ...t.scanPage, scan: t.scan, card: t.card }}
        can={{ adjust, count, sell, create: hasRole(user, ['manager']) }}
      />
    </StaffPage>
  );
}
