import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CountScreen } from '@/components/staff/count-screen';
import { TopBar } from '@/components/staff/top-bar';
import { getPayloadClient } from '@/lib/payload';
import { staffItems } from '@/modules/catalogue/service';
import { requireStaff } from '../../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Inventaire' };

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { id: string }).id : String(v));

export default async function CountPage({ params }: PageProps<'/staff/count/[id]'>) {
  const { id } = await params;
  const { locale, t } = await requireStaff('count', `/staff/count/${id}`);
  const payload = await getPayloadClient();
  const count = await payload.findByID({ collection: 'stockCounts', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!count) notFound();
  if (count.status !== 'open') redirect('/staff/count');
  const ids = (count.lines ?? []).map((l) => idOf(l.variant));
  const items = new Map((await staffItems(payload, ids, locale)).map((i) => [i.variant, i]));
  const lines = (count.lines ?? []).map((l) => {
    const item = items.get(idOf(l.variant));
    return { variant: idOf(l.variant), name: [item?.name, item?.label].filter(Boolean).join(' · '), counted: l.counted };
  });
  return (
    <>
      <TopBar title={count.note || t.countPage.untitled} back={{ href: '/staff/count', label: t.back }} />
      <main className="p-4">
        <CountScreen id={id} initial={lines} t={{ ...t.countScreen, scan: t.scan }} />
      </main>
    </>
  );
}
