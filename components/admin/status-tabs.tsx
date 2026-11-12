import Link from 'next/link';
import type { CollectionSlug, Payload } from 'payload';
import type { Label } from '@/lib/admin';
import { valuesOf } from '@/modules/sales/admin/order-tabs';

// Simple stage tabs above a list (APPLUX report 4, §7): table reservations and catering requests get the clarity of
// the Orders tabs without Payload's filter builder. A tab is a plain list query on `status`, so the search, columns
// and paging keep working. Wired with `statusTabs()` (lib/admin.ts).

export type StatusTab = { label: Label; statuses?: string[]; sort?: string; urgent?: boolean };
type Props = { payload: Payload; searchParams?: Record<string, unknown>; i18n?: { language: string }; collection: CollectionSlug; tabs: StatusTab[] };

export default async function StatusTabs({ payload, searchParams = {}, i18n, collection, tabs }: Props) {
  const lang = (i18n?.language ?? 'fr') as keyof Label;
  const current = valuesOf(searchParams, /^where\[.*\]\[status\]\[(in|equals)\](\[\d+\])?$/).sort().join(',');
  const counts = await Promise.all(tabs.map((t) => payload.count({ collection, where: t.statuses ? { status: { in: t.statuses } } : {}, overrideAccess: true }).then((r) => r.totalDocs)));
  const href = (t: StatusTab) => {
    const params = new URLSearchParams();
    (t.statuses ?? []).forEach((s, n) => params.set(`where[and][0][status][in][${n}]`, s));
    if (t.sort) params.set('sort', t.sort);
    return `?${params.toString()}`;
  };
  return (
    <nav className="gg-tabs">
      {tabs.map((t, i) => (
        <Link key={i} href={href(t)} className="gg-tabs__tab" data-active={(t.statuses ?? []).toSorted().join(',') === current || undefined} data-urgent={(t.urgent && counts[i] > 0) || undefined}>
          {t.label[lang] ?? t.label.fr}
          <span className="gg-tabs__count">{counts[i]}</span>
        </Link>
      ))}
    </nav>
  );
}
