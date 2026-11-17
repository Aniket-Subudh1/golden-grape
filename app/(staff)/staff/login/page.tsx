import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/staff/login-form';
import { getDictionary } from '@/lib/i18n';
import { currentStaff } from '@/modules/settings/service';

export const instant = false;
export const metadata: Metadata = { title: 'Connexion' };

/** Only paths of the staff screens: a `next` pointing anywhere else is ignored. */
const safeNext = (next: unknown) => (typeof next === 'string' && /^\/staff(\/|\?|$)/.test(next) && !next.startsWith('/staff/login') ? next : '/staff');

/** Staff sign-in (M3.1 T1). In French: the language of the account is only known once signed in. */
export default async function StaffLogin({ searchParams }: PageProps<'/staff/login'>) {
  const next = safeNext((await searchParams).next);
  if (await currentStaff()) redirect(next);
  const { staff: t, form } = await getDictionary('fr');
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Image src="/brand/mark.png" alt="Golden Grape" width={56} height={60} className="mb-8" priority />
      <p className="eyebrow mb-3 text-gold-deep">{t.login.eyebrow}</p>
      <h1 className="mb-10 font-serif text-4xl leading-tight">{t.login.title}</h1>
      <LoginForm
        next={next}
        t={t.login}
        messages={{ error: t.login.invalid, RATE_LIMITED: form.RATE_LIMITED, FORBIDDEN: t.login.invalid, fields: form.fields }}
      />
    </main>
  );
}
