import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { Button } from '@/components/ui/button';
import { getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { AccountNav } from '@/modules/customers/components/account-nav';
import { SignOutButton } from '@/modules/customers/components/account-forms';
import { currentCustomer } from '@/modules/customers/service';

/** Every account page needs a signed-in customer. Guests are sent to sign-in by proxy.ts; an expired session lands here. */
async function Shell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [customer, { account: t }] = await Promise.all([currentCustomer(), getDictionary(locale)]);
  if (!customer) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="eyebrow mb-4 text-gold-deep">{t.eyebrow}</p>
        <h1 className="font-serif text-4xl tracking-tight">{t.expiredTitle}</h1>
        <p className="mt-4 text-sm text-ink/60">{t.errors.signedOut}</p>
        <Button asChild className="mt-8">
          <Link href={`${localePath(locale, '/auth')}?next=${encodeURIComponent(localePath(locale, '/account'))}`}>{t.signIn}</Link>
        </Button>
      </div>
    );
  }
  const base = localePath(locale, '/account');
  return (
    <>
      <div className="flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-4 text-gold-deep">{t.eyebrow}</p>
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-6xl">
            {t.hello} <em className="text-gold-deep italic">{customer.name.split(' ')[0]}.</em>
          </h1>
          {customer.type === 'business' && customer.company && <p className="mt-4 text-sm text-ink/60">{customer.company}</p>}
        </div>
        <SignOutButton label={t.signOut} home={localePath(locale)} />
      </div>
      <div className="mt-8">
        <AccountNav
          items={[
            { href: base, label: t.nav.overview },
            { href: `${base}/profile`, label: t.nav.profile },
            { href: `${base}/addresses`, label: t.nav.addresses },
            { href: `${base}/orders`, label: t.nav.orders },
          ]}
        />
      </div>
      <div className="mt-12">{children}</div>
    </>
  );
}

export default async function AccountLayout({ params, children }: LayoutProps<'/[locale]/account'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <section className="pt-36 pb-32 md:pt-44">
      <Container size="md">
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Shell locale={locale}>{children}</Shell>
        </Suspense>
      </Container>
    </section>
  );
}
