import { CalendarDays, ScanBarcode } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm, LoginLanguage } from '@/components/staff/login-form';
import { getDictionary, isLocale } from '@/lib/i18n';
import { currentStaff } from '@/modules/settings/service';

export const instant = false;
export const metadata: Metadata = { title: 'Connexion' };

/** Only paths of the staff screens: a `next` pointing anywhere else is ignored. */
const safeNext = (next: unknown) => (typeof next === 'string' && /^\/staff(\/|\?|$)/.test(next) && !next.startsWith('/staff/login') ? next : '/staff');

/**
 * Staff sign-in (M3.1 T1), in the back office sign-in's layout: lockup top left, heading and form centred, the language
 * top right, and on wide screens the rounded photo panel with two notes. Its language: the one picked here or on the
 * back office's sign-in (shared cookie), French until then; the account's own language applies once signed in.
 */
export default async function StaffLogin({ searchParams }: PageProps<'/staff/login'>) {
  const next = safeNext((await searchParams).next);
  if (await currentStaff()) redirect(next);
  const picked = (await cookies()).get('payload-lng')?.value;
  const locale = isLocale(picked) ? picked : 'fr';
  const { staff, form } = await getDictionary(locale);
  const t = staff.login;
  return (
    <div lang={locale} className="min-h-dvh bg-[radial-gradient(70%_50%_at_0%_100%,rgb(201_162_74/0.12),transparent_70%),radial-gradient(60%_40%_at_0%_0%,rgb(201_162_74/0.06),transparent_70%)] bg-[#f6f8fb] lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-6 pb-8 pt-[max(1.75rem,env(safe-area-inset-top))] lg:px-[92px] lg:pb-9 lg:pt-9">
        <header className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-3.5">
            <Image src="/brand/mark.png" alt="" width={41} height={44} className="h-11 w-auto" priority />
            <span className="grid gap-0.5 leading-tight">
              <span className="text-xl font-semibold tracking-[-0.015em]">
                Golden <b className="font-bold text-gold-deep">Grape</b>
              </span>
              <span className="text-sm text-ink/60">{t.app}</span>
            </span>
          </span>
        </header>

        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <div className="mb-8 text-center">
            <Image src="/brand/mark.png" alt="" width={48} height={52} className="mx-auto mb-5 hidden h-[52px] w-auto lg:block" />
            <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-normal">{t.title}</h1>
            <p className="mt-2 text-[15px] text-ink/60">{t.text}</p>
          </div>
          <LoginForm next={next} t={t} messages={{ error: t.invalid, RATE_LIMITED: form.RATE_LIMITED, FORBIDDEN: t.invalid, fields: form.fields }} />
        </main>

        <p className="hidden text-[13px] text-ink/60 lg:block">Golden Grape Luxembourg · 25 Zac Klengbousbierg, Bissen</p>
      </div>

      {/* One menu for every width: beside the lockup on phones, on the photo's corner on wide screens (outside the
          photo panel, which is hidden from screen readers). */}
      <div className="fixed right-6 top-[max(2rem,calc(env(safe-area-inset-top)+0.25rem))] z-10 lg:right-10 lg:top-10">
        <LoginLanguage current={locale} label={t.language} />
      </div>

      <aside aria-hidden="true" className="relative m-3 hidden overflow-hidden rounded-[28px] lg:block">
        <Image src="/brand/home-store/Home_9.jpg" alt="" fill sizes="50vw" priority className="object-cover" />
        <Note className="left-12 top-14 bg-[rgb(143_106_36/0.88)]" icon={<ScanBarcode />} title={t.note1} text={t.note1Text} />
        <Note className="bottom-14 right-10 bg-[rgb(20_17_13/0.55)]" icon={<CalendarDays />} title={t.note2} text={t.note2Text} />
      </aside>
    </div>
  );
}

function Note({ className, icon, title, text }: { className: string; icon: ReactNode; title: string; text: string }) {
  return (
    <div className={`absolute flex max-w-[304px] items-start gap-3.5 rounded-xl px-[18px] py-4 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] backdrop-blur-[14px] ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white/90 text-gold-deep [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span>
        <b className="block text-[15px]">{title}</b>
        <span className="mt-0.5 block text-[13px] leading-[1.45] text-white/80">{text}</span>
      </span>
    </div>
  );
}
