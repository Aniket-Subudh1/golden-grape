import type { Metadata } from 'next';
import Link from 'next/link';
import { StartCount } from '@/components/staff/start-count';
import { TopBar } from '@/components/staff/top-bar';
import { interpolate } from '@/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { dayStamp } from '@/lib/time';
import { openCounts } from '@/modules/inventory/service';
import { requireStaff } from '../../session';

export const instant = false;
export const metadata: Metadata = { title: 'Inventaire' };

/** Open counts to carry on, and a new one (M3.1 T3). */
export default async function CountsPage() {
  const { t, dict } = await requireStaff('count');
  const counts = await openCounts(await getPayloadClient());
  return (
    <>
      <TopBar title={t.countPage.title} back={{ href: '/staff', label: t.back }} />
      <main className="space-y-6 p-4">
        <StartCount t={t.countPage} messages={{ error: dict.form.error, fields: dict.form.fields }} />
        <section>
          <h2 className="eyebrow mb-2 text-ink/60">{t.countPage.open}</h2>
          {counts.length === 0 ? (
            <p className="text-sm text-ink/55">{t.countPage.none}</p>
          ) : (
            <ul className="space-y-2">
              {counts.map((c) => (
                <li key={c.id}>
                  <Link href={`/staff/count/${c.id}`} className="flex items-center justify-between rounded-xl border border-border bg-white/70 px-4 py-3">
                    <span>
                      <span className="block">{c.note || t.countPage.untitled}</span>
                      <span className="text-xs text-ink/55">{[dayStamp(new Date(c.at)), c.user].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="text-sm text-ink/60">{interpolate(t.countPage.lines, { n: c.lines })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
