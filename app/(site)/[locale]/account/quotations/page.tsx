import { FileSignature } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/cn';
import { type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { currentCustomer } from '@/modules/customers/service';
import { quotationsOf } from '@/modules/documents/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/quotations'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.quotations.title} · Golden Grape`, robots: { index: false } };
}

/** "Mes devis": the customer's catering quotations, to sign or signed, each opening its page and PDFs (Q-12). */
async function Quotations({ locale, t }: { locale: Locale; t: Dictionary['account'] }) {
  const customer = await currentCustomer();
  if (!customer) return null; // the layout shows the signed-out panel
  const docs = await quotationsOf(await getPayloadClient(), customer);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' });
  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 font-serif text-3xl">
        <FileSignature className="h-5 w-5 text-gold-deep" /> {t.quotations.title}
      </h2>
      {docs.length === 0 ? (
        <p className="text-sm text-ink/60">{t.quotations.empty}</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {docs.map((q) => {
            const status = (q.status ?? 'sent') as keyof typeof t.quotations.status;
            const open = status === 'sent' || status === 'viewed';
            return (
              <li key={q.id}>
                <Link href={localePath(locale, `/quotation/${q.id}`)} className="group flex flex-wrap items-center gap-x-6 gap-y-2 py-5 transition hover:bg-champagne/30 sm:px-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl group-hover:text-gold-deep">{q.event?.date ? day.format(new Date(q.event.date)) : q.number}</span>
                    <span className="mt-0.5 block text-xs text-ink/50 tabular-nums">{q.number}</span>
                  </span>
                  <span className={cn('rounded-full px-3 py-1 text-[10px] tracking-[0.18em] uppercase', open ? 'bg-gold/15 text-gold-deep' : 'bg-champagne text-ink/60')}>
                    {t.quotations.status[status] ?? status}
                  </span>
                  <span className="w-24 text-right text-sm tabular-nums">{formatMoney(q.totals?.totalCents ?? 0, locale)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function AccountQuotationsPage({ params }: PageProps<'/[locale]/account/quotations'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <Quotations locale={locale} t={account} />
    </Suspense>
  );
}
