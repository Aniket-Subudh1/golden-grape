import Image from 'next/image';
import type { ReactNode } from 'react';

/** The sign-in screens: the prototype's dark brand panel (logo, "Maison", serif title) beside the form on bone. */
export function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-ink text-bone lg:block">
        <Image src="/brand/owners-team/Owners_8.jpg" alt="" fill sizes="45vw" className="object-cover opacity-35" />
        <div className="bg-azulejo absolute inset-0 opacity-[0.07]" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-end p-16 pb-20">
          <p className="eyebrow mb-4 text-gold">{eyebrow}</p>
          <p className="max-w-md font-serif text-5xl leading-[1.02] font-light">{title}</p>
          <p className="mt-5 max-w-sm text-sm font-light text-bone/70">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 pt-header pb-20 md:px-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </section>
  );
}
