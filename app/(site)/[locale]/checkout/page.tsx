import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { currentCustomer } from '@/modules/customers/service';
import { getSettings } from '@/modules/settings/service';
import { CheckoutForm } from '@/modules/webshop/components/checkout-form';

type Props = PageProps<'/[locale]/checkout'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.checkout, robots: { index: false } };
}

const MODES = ['pickup', 'delivery', 'table'] as const;

/** The signed-in customer's details and default address fill the form; `?mode=table` opens on a table. */
async function Checkout({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const [customer, sp, { checkout, cart, form }, { business }] = await Promise.all([currentCustomer(), searchParams, getDictionary(locale), getSettings()]);
  const address = customer?.addresses?.find((a) => a.isDefault) ?? customer?.addresses?.[0] ?? null;
  const mode = MODES.find((m) => m === sp.mode) ?? null;
  return (
    <CheckoutForm
      locale={locale}
      initialMode={mode}
      customer={
        customer && {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: address && { line1: address.line1, line2: address.line2, postalCode: address.postalCode, city: address.city },
          addresses: (customer.addresses ?? []).map((a) => ({ id: a.id ?? a.line1, label: a.label, line1: a.line1, line2: a.line2, postalCode: a.postalCode, city: a.city })),
        }
      }
      t={checkout}
      cartT={{ modes: cart.modes, hints: cart.hints, minus: cart.minus, plus: cart.plus, toShop: cart.toShop, toCounter: cart.toCounter, vatIncluded: cart.vatIncluded }}
      formT={form}
      phone={business.phone}
      signInHref={`${localePath(locale, '/auth')}?next=${encodeURIComponent(localePath(locale, '/checkout'))}`}
    />
  );
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { checkout: t } = await getDictionary(locale);
  return (
    <section className="pt-36 pb-32 md:pt-44">
      <Container>
        <header className="mb-12 md:mb-16">
          <p className="eyebrow mb-4 text-gold-deep">{t.eyebrow}</p>
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">{t.title}</h1>
        </header>
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Checkout locale={locale} searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}
