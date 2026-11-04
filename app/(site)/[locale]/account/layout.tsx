import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/site/container';
import { getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { AccountNav } from '@/modules/customers/components/account-nav';
import { SignOutButton } from '@/modules/customers/components/account-forms';
import { currentCustomer } from '@/modules/customers/service';

/** Every account page needs a signed-in customer; a guest goes to the sign-in page and comes back here. */
async function Shell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const customer = await currentCustomer();
  if (!customer) redirect(`${localePath(locale, '/auth')}?next=${encodeURIComponent(localePath(locale, '/account'))}`);
  const { account: t } = await getDictionary(locale);
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
            // Order history: linked once the customer has orders (they arrive with checkout, M2.3).
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
