'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Locale, localePath } from '@/lib/i18n';
import { LanguageSwitcher } from './language-switcher';
import { type NavItem, NavLink } from './nav-link';

type Props = { locale: Locale; items: NavItem[]; labels: { openMenu: string; closeMenu: string; language: string } };

const LOGO_ALT = 'Golden Grape · Mäi Wäin';

/** Transparent over the home hero until the page scrolls; solid everywhere else. */
export function Nav({ locale, items, labels }: Props) {
  const isHome = usePathname() === localePath(locale);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const solid = !isHome || scrolled;
  const linkClass = (item: NavItem) => (item.href ? 'transition-colors hover:text-gold' : undefined);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        solid ? 'border-b border-border/60 bg-bone/85 text-ink backdrop-blur-xl' : 'bg-transparent text-bone',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:h-20 md:px-10">
        <button onClick={() => setOpen(true)} className="-ml-2 p-2 lg:hidden" aria-label={labels.openMenu}>
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden items-center gap-9 text-[11px] font-medium tracking-[0.28em] uppercase lg:flex">
          {items.slice(0, 3).map((item) => (
            <NavLink key={item.label} item={item} className={linkClass(item)} />
          ))}
        </nav>

        <Link href={localePath(locale)} className="group flex items-center gap-3" aria-label="Golden Grape">
          <span className="relative block h-10 w-auto md:h-14">
            <Image
              src="/brand/logo-light.png"
              alt=""
              aria-hidden="true"
              width={1200}
              height={1200}
              priority
              sizes="56px"
              className={cn('h-full w-auto object-contain transition-opacity duration-500', solid ? 'opacity-0' : 'opacity-100')}
            />
            <Image
              src="/brand/logo-dark.png"
              alt={LOGO_ALT}
              width={1200}
              height={1200}
              priority
              sizes="56px"
              className={cn(
                'absolute inset-0 h-full w-auto object-contain transition-opacity duration-500',
                solid ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-[11px] font-medium tracking-[0.28em] uppercase lg:flex">
          {items.slice(3).map((item) => (
            <NavLink key={item.label} item={item} className={linkClass(item)} />
          ))}
          <span className="mx-1 h-3 w-px bg-current opacity-20" />
          <LanguageSwitcher locale={locale} label={labels.language} tone={solid ? 'dark' : 'light'} />
        </nav>

        {/* Keeps the logo centred on mobile while the account and cart icons are hidden (until M2.2). */}
        <span className="w-9 lg:hidden" aria-hidden="true" />
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 bg-ink text-bone transition-opacity duration-500',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        inert={!open}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="eyebrow text-gold">Golden Grape</span>
          <button onClick={() => setOpen(false)} aria-label={labels.closeMenu}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-8 px-8 pt-16">
          {items.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              onClick={() => setOpen(false)}
              className="font-serif text-5xl tracking-tight"
            />
          ))}
          <div className="border-t border-bone/10 pt-8">
            <LanguageSwitcher locale={locale} label={labels.language} tone="light" placement="above-start" />
          </div>
        </div>
      </div>
    </header>
  );
}
