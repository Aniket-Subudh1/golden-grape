'use client';

import { Menu, Phone, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Locale, localePath } from '@/lib/i18n';
import { useCart } from '@/modules/webshop/cart';
import { LanguageSwitcher } from './language-switcher';
import { type NavItem, NavLink } from './nav-link';
import { InstagramIcon } from './social-icons';

type Props = {
  locale: Locale;
  items: NavItem[];
  labels: { openMenu: string; closeMenu: string; language: string; phone: string; search: string; account: string; bag: string };
  phone?: string | null;
  instagram?: string | null;
};

const LOGO_ALT = 'Golden Grape · Mäi Wäin';

/** Links either side of the logo. Transparent and tall over the home hero; compact and dark after scrolling and on other pages. */
export function Nav({ locale, items, labels, phone, instagram }: Props) {
  const pathname = usePathname();
  const isHome = pathname === localePath(locale);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const cart = useCart();

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
      'relative py-1.5 whitespace-nowrap',
      item.href &&
        'transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-500 hover:text-gold hover:after:scale-x-100',
      isActive(item) && 'text-gold after:scale-x-100',
    );
  const linkRow = 'hidden items-center gap-4 text-[10px] font-medium tracking-[0.14em] uppercase md:flex lg:gap-7 lg:text-[11px] lg:tracking-[0.24em] xl:gap-9 xl:tracking-[0.28em]';
  const icon = 'hidden transition-colors hover:text-gold xl:block';
  const tool = 'relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-gold';
  const bag = (
    <button type="button" onClick={() => cart.setOpen(true)} aria-label={labels.bag} className={tool}>
      <ShoppingBag className="h-[18px] w-[18px]" />
      {cart.count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-medium text-ink">{cart.count}</span>
      )}
    </button>
  );

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 text-bone transition-all duration-500',
        solid ? 'border-b border-gold/20 bg-ink/95 backdrop-blur-xl' : 'bg-gradient-to-b from-ink/60 to-transparent',
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 transition-all duration-500 md:px-6 lg:gap-6 lg:px-10',
          solid ? 'h-20 md:h-24' : 'h-24 md:h-32',
        )}
      >
        <div className="flex items-center">
          <button onClick={() => setOpen(true)} className="-ml-2 p-2 md:hidden" aria-label={labels.openMenu}>
            <Menu className="h-5 w-5" />
          </button>
          <nav className={linkRow}>
            {items.slice(0, 3).map((item) => (
              <NavLink key={item.label} item={item} className={linkClass(item)} aria-current={isActive(item) ? 'page' : undefined} />
            ))}
          </nav>
        </div>

        <Link href={localePath(locale)} className="block" aria-label={LOGO_ALT}>
          <span className={cn('relative block aspect-[1085/859] transition-all duration-500', solid ? 'h-16 md:h-20' : 'h-20 md:h-28')}>
            <Image src="/brand/logo-light.png" alt={LOGO_ALT} loading="eager" fill sizes="(min-width: 768px) 142px, 102px" className="object-contain" />
          </span>
        </Link>

        <div className="flex items-center justify-end">
          <nav className={linkRow}>
            {items.slice(3).map((item) => (
              <NavLink key={item.label} item={item} className={linkClass(item)} aria-current={isActive(item) ? 'page' : undefined} />
            ))}
            <span className="hidden h-3 w-px bg-current opacity-25 lg:block" />
            <LanguageSwitcher locale={locale} label={labels.language} />
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} aria-label={labels.phone} className={icon}>
                <Phone className="h-4 w-4" />
              </a>
            )}
            {instagram && (
              <a href={instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer" className={icon}>
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
          </nav>
          <div className="ml-1 hidden items-center md:flex lg:ml-3">
            <Link href={`${localePath(locale, '/shop')}#search`} aria-label={labels.search} className={tool}>
              <Search className="h-[18px] w-[18px]" />
            </Link>
            <Link href={localePath(locale, '/account')} aria-label={labels.account} className={tool}>
              <UserRound className="h-[18px] w-[18px]" />
            </Link>
            {bag}
          </div>
          <div className="flex items-center md:hidden">
            <LanguageSwitcher locale={locale} label={labels.language} />
            {bag}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 h-dvh overflow-y-auto bg-ink text-bone transition-opacity duration-500',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        inert={!open}
      >
        <div className="bg-azulejo pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden="true" />
        <div className="relative flex h-24 items-center justify-between px-5">
          <Image src="/brand/logo-light.png" alt={LOGO_ALT} width={1085} height={859} sizes="102px" className="h-20 w-auto" />
          <button onClick={() => setOpen(false)} aria-label={labels.closeMenu} className="-mr-2 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative flex flex-col gap-6 px-8 pt-10 pb-10">
          {items.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              onClick={() => setOpen(false)}
              className={cn('font-serif text-4xl font-light tracking-tight sm:text-5xl', isActive(item) && 'text-gold')}
            />
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-6 border-t border-bone/10 pt-8">
            <Link href={localePath(locale, '/account')} onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-light text-bone/80">
              <UserRound className="h-4 w-4 text-gold" />
              {labels.account}
            </Link>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm font-light text-bone/80">
                <Phone className="h-4 w-4 text-gold" />
                {phone}
              </a>
            )}
            {instagram && (
              <a href={instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="text-bone/80">
                <InstagramIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
