import { CircleCheck, CircleX, Clock, FileText, Link2Off } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';
import { Container } from '@/components/site/container';
import { Button } from '@/components/ui/button';
import { hasRole } from '@/lib/access';
import { audit } from '@/lib/audit';
import { type Dictionary, getDictionary, interpolate, isLocale } from '@/lib/i18n';
import { checkLinkToken, linkToken } from '@/lib/link-token';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { model } from '@/lib/tx';
import { currentCustomer } from '@/modules/customers/service';
import { QuotationDecision } from '@/modules/documents/components/quotation-decision';
import { isExpired, markViewed } from '@/modules/documents/service';
import { getSettings } from '@/modules/settings/service';

type Props = PageProps<'/[locale]/quotation/[id]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { documents } = await getDictionary(locale);
  return { title: documents.view.metaTitle, robots: { index: false } };
}

function State({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex gap-4 border border-border/70 bg-champagne/40 p-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-deep">{icon}</span>
      <div className="space-y-2">
        <h2 className="font-serif text-2xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Invalid({ t }: { t: Dictionary['order'] }) {
  return (
    <div className="mx-auto max-w-xl">
      <State icon={<Link2Off className="h-5 w-5" />} title={t.invalidTitle} />
    </div>
  );
}

/**
 * A catering quotation for the customer who holds the link of the e-mail (or is signed in as its owner): read it,
 * download it, accept and sign it, or decline it (Q-12). Opening it marks it viewed; past its validity it is expired.
 */
async function QuotationView({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  await connection(); // private and live: never prerendered
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const t = dict.documents;
  if (!/^[a-f0-9]{24}$/.test(id)) return <Invalid t={dict.order} />;

  const payload = await getPayloadClient();
  const token = typeof sp.t === 'string' ? sp.t : null;
  const [found, customer, { user }] = await Promise.all([
    payload.findByID({ collection: 'quotations', id, depth: 0, overrideAccess: true, disableErrors: true }),
    currentCustomer(),
    payload.auth({ headers: await headers() }),
  ]);
  const owner = Boolean(found?.customer && customer && String(found.customer) === customer.id);
  if (!found || found.status === 'draft' || !(owner || checkLinkToken('quotation', id, token))) return <Invalid t={dict.order} />;
  let q = found;

  // The customer opened it (staff checking the link do not count); past its last valid day it expires now.
  const now = new Date();
  if (isExpired(q, now)) {
    const done = await model(payload, 'quotations').updateOne({ _id: q.id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'expired', expiredAt: now } });
    if (done.modifiedCount) await audit(payload, { action: 'quotation.expired', collection: 'quotations', id: q.id, ref: q.number });
    q = { ...q, status: 'expired' };
  } else if (q.status === 'sent' && !hasRole(user, ['sales']) && (await markViewed(payload, q.id, now))) {
    await audit(payload, { action: 'quotation.viewed', collection: 'quotations', id: q.id, ref: q.number });
    q = { ...q, status: 'viewed' };
  }

  const { business } = await getSettings();
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, locale);
  const day = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(v)) : '—');
  const rate = (bp: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);
  const fileHref = (file: unknown) => {
    const fid = typeof file === 'object' && file ? (file as { id: string }).id : String(file);
    return `/api/documents/${fid}?t=${linkToken('document', fid)}`;
  };
  const open = q.status === 'sent' || q.status === 'viewed';
  // The signed-in owner signs without the e-mail's link: their session proved who they are.
  const signToken = token ?? (owner ? linkToken('quotation', q.id) : null);
  const totals = q.totals;

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
      <div className="min-w-0 space-y-10">
        <header>
          <p className="eyebrow mb-4 text-gold-deep">{t.title}</p>
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-6xl">{q.number}</h1>
          <p className="mt-4 text-lg font-light text-ink/70">{interpolate(t.view.intro, { name: q.contact?.name?.split(' ')[0] ?? '' })}</p>
          <p className="mt-2 text-sm text-ink/50">
            {t.validUntil} {day(q.validUntil)}
          </p>
        </header>

        <dl className="grid gap-6 border-y border-border/70 py-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="eyebrow mb-1 text-ink/50">{t.event}</dt>
            <dd>{[day(q.event?.date), q.event?.time].filter(Boolean).join(' · ')}</dd>
          </div>
          {q.event?.guests ? (
            <div>
              <dt className="eyebrow mb-1 text-ink/50">{t.customer}</dt>
              <dd>
                {q.contact?.name} · {interpolate(t.guests, { count: q.event.guests })}
              </dd>
            </div>
          ) : null}
          {q.event?.location ? (
            <div>
              <dt className="eyebrow mb-1 text-ink/50">{dict.mail.labels.location}</dt>
              <dd>{q.event.location}</dd>
            </div>
          ) : null}
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gold-deep text-left text-[11px] tracking-[0.18em] text-ink/50 uppercase">
                <th className="py-2 font-normal">{t.description}</th>
                <th className="py-2 text-right font-normal">{t.qty}</th>
                <th className="py-2 text-right font-normal">{t.unitPrice}</th>
                <th className="py-2 text-right font-normal">{t.vat}</th>
                <th className="py-2 text-right font-normal">{t.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {(q.lines ?? []).map((line, i) => (
                <tr key={line.id ?? i} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{line.description}</span>
                    {line.detail && <span className="mt-0.5 block text-xs text-ink/50">{line.detail}</span>}
                  </td>
                  <td className="py-3 text-right tabular-nums">{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(line.qty)}</td>
                  <td className="py-3 text-right tabular-nums">{money(line.unitPriceCents)}</td>
                  <td className="py-3 text-right tabular-nums">{rate(line.vatBp ?? 0)} %</td>
                  <td className="py-3 text-right font-medium tabular-nums">{money(line.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto max-w-sm space-y-1 text-sm">
          {totals?.discountCents ? (
            <>
              <div className="flex justify-between">
                <dt>{t.subtotal}</dt>
                <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t.discount}</dt>
                <dd className="tabular-nums">− {money(totals.discountCents)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-baseline justify-between border-t border-gold-deep pt-2">
            <dt className="eyebrow text-ink/60">{t.total}</dt>
            <dd className="font-serif text-3xl tabular-nums">{money(totals?.totalCents)}</dd>
          </div>
          {(totals?.vatBreakdown ?? []).map((v) => (
            <div key={v.rateBp ?? 0} className="flex justify-between text-xs text-ink/50">
              <dt>{interpolate(t.vatLine, { rate: rate(v.rateBp ?? 0), base: money(v.baseCents) })}</dt>
              <dd className="tabular-nums">{money(v.vatCents)}</dd>
            </div>
          ))}
        </dl>

        {q.conditions && (
          <section>
            <h2 className="eyebrow mb-2 text-gold-deep">{t.conditions}</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink/70">{q.conditions}</p>
          </section>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
        {q.status === 'accepted' ? (
          <State icon={<CircleCheck className="h-5 w-5" />} title={t.view.accepted}>
            <p className="text-sm text-ink/70">{interpolate(t.view.acceptedText, { name: q.signature?.name ?? '', date: day(q.acceptedAt) })}</p>
          </State>
        ) : q.status === 'declined' ? (
          <State icon={<CircleX className="h-5 w-5" />} title={t.view.declined}>
            <p className="text-sm text-ink/70">{interpolate(t.view.declinedText, { date: day(q.declinedAt) })}</p>
          </State>
        ) : q.status === 'expired' ? (
          <State icon={<Clock className="h-5 w-5" />} title={t.view.expired}>
            <p className="text-sm text-ink/70">{interpolate(t.view.expiredText, { date: day(q.validUntil) })}</p>
            <p className="text-sm">
              {business.phone && <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="border-b border-gold-deep text-gold-deep">{business.phone}</a>}
              {business.phone && business.email && ' · '}
              {business.email && <a href={`mailto:${business.email}`} className="border-b border-gold-deep text-gold-deep">{business.email}</a>}
            </p>
          </State>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {q.signedPdf ? (
            <Button asChild variant="gold">
              <a href={fileHref(q.signedPdf)} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" /> {t.view.downloadSigned}
              </a>
            </Button>
          ) : q.pdf ? (
            <Button asChild variant="outline">
              <a href={fileHref(q.pdf)} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" /> {t.view.download}
              </a>
            </Button>
          ) : null}
        </div>

        {open && signToken && (
          <div className="border border-border/70 bg-bone p-6 md:p-8">
            <QuotationDecision quotation={q.id} token={signToken} t={t.view} form={dict.form} />
          </div>
        )}
      </aside>
    </div>
  );
}

export default function QuotationPage({ params, searchParams }: Props) {
  return (
    <section className="pt-36 pb-32 md:pt-44">
      <Container>
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <QuotationView params={params} searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}
