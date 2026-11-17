import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ReceiveScreen } from '@/components/staff/receive-screen';
import { StaffPage } from '@/components/staff/page';
import { hasRole } from '@/lib/access';
import { getPayloadClient } from '@/lib/payload';
import { OPEN, orderToReceive } from '@/modules/purchasing/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Réception' };

export default async function ReceivePage({ params }: PageProps<'/staff/receive/[po]'>) {
  const { po } = await params;
  const { user, locale, t } = await requireStaff('receive', `/staff/receive/${po}`);
  const order = await orderToReceive(await getPayloadClient(), po, locale);
  if (!order) notFound();
  if (!OPEN.includes(order.status)) redirect('/staff/receive');
  return (
    <StaffPage title={`${order.supplier} · ${order.number}`} back={{ href: '/staff/receive', label: t.back }}>
      <ReceiveScreen order={order} manager={hasRole(user, ['manager'])} t={{ ...t.receiveScreen, scan: t.scan }} />
    </StaffPage>
  );
}
