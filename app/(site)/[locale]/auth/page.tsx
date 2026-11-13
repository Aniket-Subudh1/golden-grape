import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/cn';
import { getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { AuthShell } from '@/modules/customers/components/auth-shell';
import { ForgotForm, GoTo, SignInForm, SignUpForm } from '@/modules/customers/components/auth-forms';
import { currentCustomer } from '@/modules/customers/service';

type Props = PageProps<'/[locale]/auth'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = await getDictionary(locale);
  return { title: `${auth.title} · Golden Grape`, robots: { index: false } };
}

/** Only paths of this site, never another host. */
// A page of this site only; an order's link keeps its token, so signing in from a confirmation comes back to it (GG-17).
const safeNext = (value: unknown, locale: Locale) => (typeof value === 'string' && /^\/(fr|en|de|pt)\/[\w/-]*(\?t=[\w-]+)?$/.test(value) ? value : localePath(locale, '/account'));

async function Forms({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  // Already signed in: hand over to the account on the client (a redirect thrown while rendering breaks instant navigation).
  if (await currentCustomer()) return <GoTo href={next} />;
  const { auth: t, form } = await getDictionary(locale);
  const view = sp.view === 'signup' || sp.view === 'forgot' ? sp.view : 'signin';
  const tab = (id: 'signin' | 'signup', label: string) => (
    <Link
      href={`${localePath(locale, '/auth')}?view=${id}${sp.next ? `&next=${encodeURIComponent(next)}` : ''}`}
      aria-current={view === id ? 'page' : undefined}
      className={cn('flex-1 border-b-2 pb-3 text-center text-[11px] tracking-[0.28em] uppercase transition', view === id ? 'border-gold-deep text-ink' : 'border-border text-ink/40 hover:text-ink')}
    >
      {label}
    </Link>
  );
  return (
    <>
      <p className="eyebrow mb-3 text-gold-deep">{t.eyebrow}</p>
      <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{view === 'forgot' ? t.forgotTitle : view === 'signup' ? t.signUpTitle : t.title}</h1>
      <p className="mt-3 text-sm text-ink/60">{view === 'forgot' ? t.forgotSubtitle : view === 'signup' ? t.signUpSubtitle : t.subtitle}</p>
      {view !== 'forgot' && (
        <nav className="mt-10 mb-8 flex gap-2" aria-label={t.title}>
          {tab('signin', t.signIn)}
          {tab('signup', t.signUp)}
        </nav>
      )}
      <div className={view === 'forgot' ? 'mt-10' : ''}>
        {view === 'signin' && <SignInForm t={t} m={form} next={next} />}
        {view === 'signup' && <SignUpForm t={t} m={form} locale={locale} next={next} />}
        {view === 'forgot' && <ForgotForm t={t} m={form} />}
      </div>
      <p className="mt-8 text-center text-xs text-ink/50">
        {view === 'signin' ? (
          <Link href={`${localePath(locale, '/auth')}?view=forgot`} className="hover:text-gold-deep">
            {t.forgot}
          </Link>
        ) : (
          view === 'forgot' && (
            <Link href={localePath(locale, '/auth')} className="hover:text-gold-deep">
              ← {t.backToSignIn}
            </Link>
          )
        )}
      </p>
      <p className="mt-10 border-t border-border pt-6 text-center text-xs text-ink/50">{t.guestNote}</p>
    </>
  );
}

export default async function AuthPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth: t } = await getDictionary(locale);
  return (
    <AuthShell eyebrow={t.panelEyebrow} title={t.panelTitle} subtitle={t.panelText}>
      <Suspense fallback={<div className="min-h-[480px]" />}>
        <Forms locale={locale} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
