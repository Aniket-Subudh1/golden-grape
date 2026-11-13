import { Check, Clock, Landmark, Link2Off, MapPin, Store, UtensilsCrossed } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';
import { Container } from '@/components/site/container';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { type Dictionary, getDictionary, interpolate, isLocale, type Locale, localePath } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { slotLabel } from '@/lib/time';
import { OrderAccount } from '@/modules/customers/components/order-account';
import { currentCustomer } from '@/modules/customers/service';
import { getPayloadClient } from '@/lib/payload';
import { checkOrderToken, getOrder, getReservation } from '@/modules/sales/service';
import { dueOf } from '@/modules/payments/service';
import { formatIban, getSettingsPrivate } from '@/modules/settings/service';
import { orderBankAccount } from '@/modules/sales/service';
import type { Order } from '@/payload-types';

type Props = PageProps<'/[locale]/order/[id]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.order, robots: { index: false } };
}

const percent = (bp: number, locale: Locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100);
const TONE: Record<string, string> = {
  pending: 'bg-gold/15 text-gold-deep',
  awaiting_payment: 'bg-gold/15 text-gold-deep',
  accepted: 'bg-emerald-50 text-emerald-800',
  confirmed: 'bg-emerald-50 text-emerald-800',
  ready: 'bg-emerald-50 text-emerald-800',
  out_for_delivery: 'bg-sky-50 text-sky-800',
  completed: 'bg-champagne text-ink/70',
  rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-red-50 text-red-800',
  no_show: 'bg-red-50 text-red-800',
  refunded: 'bg-red-50 text-red-800',
};

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border border-border/70 p-6">
      <p className="eyebrow mb-3 flex items-center gap-2 text-gold-deep">
        {icon} {title}
      </p>
      <div className="text-sm leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function Lines({ order, locale, t, vatIncluded }: { order: Order; locale: Locale; t: Dictionary['checkout']; vatIncluded: string }) {
  const money = (c: number | null | undefined) => formatMoney(c ?? 0, locale);
  const totals = order.totals;
  return (
    <div>
      <ul className="divide-y divide-border/60 border-y border-border/60">
        {(order.lines ?? []).map((l) => (
          <li key={l.id} className="flex items-baseline gap-4 py-4 text-sm">
            <span className="w-8 text-ink/50 tabular-nums">{l.unitQty}×</span>
            <span className="min-w-0 flex-1">
              {l.name}
              {l.detail && <span className="block text-xs text-ink/50">{l.detail}</span>}
            </span>
            <span className="tabular-nums">{money(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/60">{t.subtotal}</dt>
          <dd className="tabular-nums">{money(totals?.subtotalCents)}</dd>
        </div>
        {order.mode === 'delivery' && (
          <div className="flex justify-between">
            <dt className="text-ink/60">{t.delivery}</dt>
            <dd className="tabular-nums">{totals?.deliveryCents ? money(totals.deliveryCents) : t.free}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
          <dt className="eyebrow text-ink/60">{t.total}</dt>
          <dd className="font-serif text-3xl tabular-nums">{money(totals?.totalCents)}</dd>
        </div>
        {(totals?.vatBreakdown ?? []).map((v) => (
          <div key={v.id} className="flex justify-between text-[11px] text-ink/50">
            <dt>{interpolate(vatIncluded, { rate: percent(v.rateBp ?? 0, locale) })}</dt>
            <dd className="tabular-nums">{money(v.vatCents)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Invalid({ locale, t }: { locale: Locale; t: Dictionary['order'] }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center border border-border/70 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/15">
        <Link2Off className="h-6 w-6 text-gold-deep" />
      </span>
      <h1 className="mt-6 font-serif text-3xl">{t.invalidTitle}</h1>
      <p className="mt-3 max-w-sm text-sm text-ink/60">{t.invalidText}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={localePath(locale, '/account/orders')}>{t.myOrders}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={localePath(locale, '/shop')}>{t.continue}</Link>
        </Button>
      </div>
    </div>
  );
}

/** An order or a table reservation, for its owner or for whoever holds the signed link from the e-mail. */
async function Confirmation({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  await connection(); // private and live: never prerendered
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const t = dict.order;
  if (!/^[a-f0-9]{24}$/.test(id)) return <Invalid locale={locale} t={t} />;

  const payload = await getPayloadClient();
  const [order, reservation, customer] = await Promise.all([getOrder(payload, id), getReservation(payload, id), currentCustomer()]);
  const doc = order ?? reservation;
  const owner = doc?.customer && customer && String(doc.customer) === customer.id;
  if (!doc || !(owner || checkOrderToken(id, typeof sp.t === 'string' ? sp.t : null))) return <Invalid locale={locale} t={t} />;

  const preorder = reservation?.preorder ? await getOrder(payload, String(reservation.preorder)) : null;
  const shown = order ?? preorder;
  const status = (doc.status ?? 'pending') as string;
  const statusName = reservation ? t.reservationStatus[status as keyof typeof t.reservationStatus] : t.status[status as keyof typeof t.status];
  const awaiting = order?.status === 'awaiting_payment';
  const due = order ? dueOf({ totalCents: order.totals?.totalCents ?? 0, paidCents: order.payment?.paidCents ?? 0, refundedCents: 0, refundDueCents: 0 }) : 0;
  // The transfer details while a transfer is still due, also once staff prepared the order before it (GG-01).
  const transferDue = order?.payment?.method === 'transfer' && due > 0 && status !== 'cancelled' && status !== 'refunded';
  const { business } = transferDue ? await getSettingsPrivate() : { business: null };
  // Only the account chosen for this order (APPLUX, 12 Nov), never the shop's list.
  const account = order && business ? orderBankAccount(order, business.bankAccounts) : null;
  const name = doc.contact?.name?.split(' ')[0] ?? '';
  const intro = reservation
    ? status === 'accepted'
      ? t.intro.accepted
      : status === 'rejected'
        ? t.intro.rejected
        : status === 'cancelled'
          ? t.intro.cancelled
          : status === 'no_show'
            ? t.intro.noShow
            : t.intro.table
    : status === 'cancelled' || status === 'refunded'
      ? t.intro.cancelled
      : awaiting
        ? t.intro.awaiting
        : order?.mode === 'delivery'
          ? t.intro.delivery
          : t.intro.pickup;
  const address = order?.mode === 'delivery' ? order.address : null;
  const money = (c: number | null | undefined) => formatMoney(c ?? 0, locale);
  // The payment, said beside the status (APPLUX report 4, §6): paid, a transfer to make, or to pay on site.
  const paymentName =
    shown?.payment?.status === 'paid' ? t.paid : transferDue ? interpolate(t.next.payDue, { amount: money(due) }) : shown?.payment?.method === 'transfer' ? t.payTransfer : reservation ? t.payTable : t.payOnsite;
  // What happens next, while something still does.
  const steps = reservation
    ? status === 'pending'
      ? t.next.table
      : status === 'accepted'
        ? t.next.accepted
        : []
    : awaiting
      ? t.next.transfer
      : status === 'pending' || status === 'confirmed'
        ? order?.mode === 'delivery'
          ? t.next.delivery
          : t.next.pickup
        : [];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/20">
          <Check className="h-5 w-5 text-gold-deep" />
        </span>
        <p className="eyebrow mt-4 text-gold-deep">{interpolate(reservation ? t.reservationEyebrow : t.eyebrow, { number: doc.number ?? '' })}</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight md:text-4xl">{interpolate(t.thanks, { name })}</h1>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className={cn('inline-flex rounded-full px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase', TONE[status] ?? 'bg-champagne')}>{statusName}</span>
          {(shown || reservation) && status !== 'cancelled' && status !== 'rejected' && status !== 'refunded' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase">
              <Landmark className="h-3 w-3 text-gold-deep" /> {paymentName}
            </span>
          )}
        </p>
        <p className="mx-auto mt-4 max-w-lg text-sm text-ink/65">{intro}</p>
        {doc.contact?.email && <p className="mt-2 text-xs text-ink/50">{interpolate(t.emailSent, { email: doc.contact.email })}</p>}
      </header>

      {steps.length > 0 && (
        <section className="mx-auto mt-6 max-w-2xl border border-border/70 bg-champagne/30 p-5">
          <h2 className="eyebrow mb-3 text-gold-deep">{t.next.title}</h2>
          <ol className="space-y-2 text-sm">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="font-serif text-gold-deep tabular-nums">{i + 1}.</span>
                <span>{interpolate(step, { amount: money(due), number: doc.number ?? '' })}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {transferDue && order && (
        <section className="mt-6 border border-gold-deep/40 bg-gold/10 p-5 md:p-6">
          <p className="eyebrow mb-4 flex items-center gap-2 text-gold-deep">
            <Landmark className="h-3.5 w-3.5" /> {t.transfer.title}
          </p>
          {/* GG-014: the reference and what is still due always; the bank details only once an account is configured. */}
          {!account && <p className="mb-5 text-sm">{t.transfer.missing}</p>}
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {(
              [
                ...(account?.iban
                  ? [
                      [t.transfer.beneficiary, account.holder || business?.legalName || business?.name],
                      ...(account.bankName ? [[t.transfer.bank, account.bankName]] : []),
                      [t.transfer.iban, formatIban(account.iban)],
                      ...(account.bic ? [[t.transfer.bic, account.bic]] : []),
                    ]
                  : []),
                [t.transfer.reference, order.number],
                [t.transfer.amount, money(due)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] tracking-[0.22em] text-ink/50 uppercase">{label}</dt>
                <dd className="mt-1 font-medium break-all tabular-nums select-all">{value}</dd>
              </div>
            ))}
          </dl>
          {account && <p className="mt-5 text-xs text-ink/60">{t.transfer.note}</p>}
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card icon={<Clock className="h-3.5 w-3.5" />} title={t.when}>
          {slotLabel(doc.slot ?? {}, locale)}
        </Card>
        <Card
          icon={reservation ? <UtensilsCrossed className="h-3.5 w-3.5" /> : address ? <MapPin className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
          title={reservation ? t.guests : t.where}
        >
          {reservation ? (
            reservation.guests
          ) : address ? (
            <>
              {address.line1}
              {address.line2 && <br />}
              {address.line2}
              <br />
              {address.postalCode} {address.city}
            </>
          ) : (
            t.modes.pickup
          )}
        </Card>
        <Card icon={<Landmark className="h-3.5 w-3.5" />} title={t.payment}>
          {paymentName}
        </Card>
      </div>

      {shown && (shown.lines ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-4 text-ink/60">{reservation ? t.preorder : t.items}</h2>
          <Lines order={shown} locale={locale} t={dict.checkout} vatIncluded={dict.cart.vatIncluded} />
        </section>
      )}

      {!customer && !doc.customer && typeof sp.t === 'string' && (
        // Optional, and said so (QA 12 Nov, GG-17): the account would use the e-mail already given; signing in to an
        // existing account comes back to this order.
        <OrderAccount
          id={id}
          token={sp.t}
          locale={locale}
          t={{ ...t.account, text: interpolate(t.account.text, { email: doc.contact?.email ?? '' }) }}
          m={dict.form}
          errors={dict.auth.errors}
          signInHref={`${localePath(locale, '/auth')}?next=${encodeURIComponent(`${localePath(locale, `/order/${id}`)}?t=${sp.t}`)}`}
        />
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={localePath(locale, '/shop')}>{t.continue}</Link>
        </Button>
        {customer && (
          <Button asChild variant="outline">
            <Link href={localePath(locale, '/account/orders')}>{t.myOrders}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function OrderPage({ params, searchParams }: Props) {
  return (
    <section className="pt-28 pb-24 md:pt-32">
      <Container>
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Confirmation params={params} searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}
