import { CheckCircle2, ChevronRight, ClipboardList, Tally5 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffPage } from '@/components/staff/page';
import { StartCount } from '@/components/staff/start-count';
import { Empty, StaffTabs } from '@/components/staff/tabs';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { dayStamp } from '@/lib/time';
import { countsBy } from '@/modules/inventory/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Inventaire' };

type Count = Awaited<ReturnType<typeof countsBy>>[number];

/** Stock counts (M3.1 T3): the ones in progress to carry on, the last ones posted; a new one in a pop-up. */
export default async function CountsPage({ searchParams }: PageProps<'/staff/count'>) {
  const { t, dict } = await requireStaff('count');
  const { tab } = await searchParams;
  const payload = await getPayloadClient();
  const [open, posted] = await Promise.all([countsBy(payload, 'open'), countsBy(payload, 'posted')]);
  const c = t.countPage;
  const row = (count: Count, live: boolean) => {
    const body = (
      <>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] ${live ? 'bg-champagne text-gold-deep' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {live ? <Tally5 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{count.note || c.untitled}</span>
          <span className="text-ink/55 block truncate text-xs">
            {[dayStamp(new Date(count.at)), count.user && interpolate(c.by, { name: count.user })]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="text-ink/70 shrink-0 text-right text-sm">
          <span className="block tabular-nums">{interpolate(c.lines, { n: count.lines })}</span>
          <span className="text-ink/50 text-xs tabular-nums">
            {interpolate(t.countScreen.units, { n: count.units })}
          </span>
        </span>
        {live && <ChevronRight className="text-ink/35 h-4 w-4 shrink-0" />}
      </>
    );
    return live ? (
      <Link
        href={`/staff/count/${count.id}`}
        className="gg-card flex items-center gap-3 px-4 py-3 transition hover:shadow-md"
      >
        {body}
      </Link>
    ) : (
      <div className="gg-card flex items-center gap-3 px-4 py-3">{body}</div>
    );
  };
  const list = (counts: Count[], live: boolean, empty: string) =>
    counts.length === 0 ? (
      <Empty icon={live ? <Tally5 /> : <ClipboardList />} text={empty} />
    ) : (
      <ul className="grid gap-2 lg:grid-cols-2">
        {counts.map((count) => (
          <li key={count.id}>{row(count, live)}</li>
        ))}
      </ul>
    );
  return (
    <StaffPage
      title={c.title}
      subtitle={c.hint}
      back={{ href: '/staff', label: t.back }}
      width="wide"
      action={
        <StartCount
          t={{ ...c, cancel: t.countScreen.cancel }}
          messages={{ error: dict.form.error, fields: dict.form.fields }}
        />
      }
    >
      <StaffTabs
        label={c.title}
        initial={typeof tab === 'string' ? tab : undefined}
        items={[
          { key: 'open', label: c.open, count: open.length, content: list(open, true, c.none) },
          { key: 'posted', label: c.history, count: posted.length, content: list(posted, false, c.noHistory) },
        ]}
      />
    </StaffPage>
  );
}
