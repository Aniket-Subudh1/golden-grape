import type { Metadata } from 'next';
import Link from 'next/link';
import { StartCount } from '@/components/staff/start-count';
import { StaffPage } from '@/components/staff/page';
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
    <StaffPage title={t.countPage.title} back={{ href: '/staff', label: t.back }} className="space-y-6">
      <StartCount t={t.countPage} messages={{ error: dict.form.error, fields: dict.form.fields }} />
      <section>
        <h2 className="eyebrow text-ink/60 mb-2">{t.countPage.open}</h2>
        {counts.length === 0 ? (
          <p className="text-ink/55 text-sm">{t.countPage.none}</p>
        ) : (
          <ul className="space-y-2">
            {counts.map((c) => (
              <li key={c.id}>
                <Link href={`/staff/count/${c.id}`} className="gg-card flex items-center justify-between px-4 py-3">
                  <span>
                    <span className="block">{c.note || t.countPage.untitled}</span>
                    <span className="text-ink/55 text-xs">
                      {[dayStamp(new Date(c.at)), c.user].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-ink/60 text-sm">{interpolate(t.countPage.lines, { n: c.lines })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StaffPage>
  );
}
