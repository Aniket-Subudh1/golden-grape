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
// Logo files are trimmed to the same 1085×859 box, so the two versions cross-fade exactly on top of each other.
const LOGO = { width: 1085, height: 859, sizes: '(min-width: 768px) 122px, 90px' };

/** Transparent and tall over the home hero; compact and solid after scrolling and on every other page. */
export function Nav({ locale, items, labels }: Props) {
  const pathname = usePathname();
  const isHome = pathname === localePath(locale);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const solid = !isHome || scrolled;
  const isActive = (item: NavItem) => !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  const linkClass = (item: NavItem) =>
    cn(
      'relative py-1.5',
      item.href &&
        'transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-500 hover:text-gold hover:after:scale-x-100',
      isActive(item) && 'text-gold-deep after:scale-x-100',
    );
  const linkRow = 'hidden items-center text-[11px] font-medium tracking-[0.28em] uppercase lg:flex';

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        solid ? 'border-b border-border/60 bg-bone/90 text-ink backdrop-blur-xl' : 'bg-gradient-to-b from-ink/60 to-transparent text-bone',
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-5 transition-all duration-500 md:px-10',
          solid ? 'h-20 md:h-24' : 'h-24 md:h-32',
        )}
      >
        <div className="flex items-center">
          <button onClick={() => setOpen(true)} className="-ml-2 p-2 lg:hidden" aria-label={labels.openMenu}>
            <Menu className="h-5 w-5" />
          </button>
          <nav className={cn(linkRow, 'gap-9')}>
            {items.slice(0, 3).map((item) => (
              <NavLink key={item.label} item={item} className={linkClass(item)} aria-current={isActive(item) ? 'page' : undefined} />
            ))}
          </nav>
        </div>

        <Link href={localePath(locale)} className="block" aria-label="Golden Grape">
          <span className={cn('relative block aspect-[1085/859] transition-all duration-500', solid ? 'h-16 md:h-20' : 'h-20 md:h-28')}>
            <Image
              src="/brand/logo-light.png"
              alt=""
              aria-hidden="true"
              priority
              fill
              sizes={LOGO.sizes}
              className={cn('object-contain transition-opacity duration-500', solid ? 'opacity-0' : 'opacity-100')}
            />
            <Image
              src="/brand/logo-dark.png"
              alt={LOGO_ALT}
              priority
              fill
              sizes={LOGO.sizes}
              className={cn('object-contain transition-opacity duration-500', solid ? 'opacity-100' : 'opacity-0')}
            />
          </span>
        </Link>

        <nav className={cn(linkRow, 'justify-end gap-7')}>
          {items.slice(3).map((item) => (
            <NavLink key={item.label} item={item} className={linkClass(item)} aria-current={isActive(item) ? 'page' : undefined} />
          ))}
          <span className="mx-1 h-3 w-px bg-current opacity-20" />
          <LanguageSwitcher locale={locale} label={labels.language} tone={solid ? 'dark' : 'light'} />
        </nav>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 h-dvh overflow-y-auto bg-ink text-bone transition-opacity duration-500',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        inert={!open}
      >
        <div className="flex h-24 items-center justify-between px-5">
          <Image src="/brand/logo-light.png" alt={LOGO_ALT} width={LOGO.width} height={LOGO.height} sizes="90px" className="h-20 w-auto" />
          <button onClick={() => setOpen(false)} aria-label={labels.closeMenu} className="-mr-2 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-8 pt-10 pb-10">
          {items.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              onClick={() => setOpen(false)}
              className={cn('font-serif text-4xl font-light tracking-tight sm:text-5xl', isActive(item) && 'text-gold')}
            />
          ))}
          <div className="mt-2 border-t border-bone/10 pt-8">
            <LanguageSwitcher locale={locale} label={labels.language} tone="light" placement="above-start" />
          </div>
        </div>
      </div>
    </header>
  );
}
