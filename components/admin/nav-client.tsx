'use client';

import { useNav, usePreferences } from '@payloadcms/ui';
import {
  ArrowLeftRight,
  CalendarCheck,
  Clock,
  MapPin,
  ShoppingBag,
  Ticket,
  BookOpenText,
  ClipboardCheck,
  Contact,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  House,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelBottom,
  Scale,
  ScrollText,
  Settings,
  Store,
  Tags,
  TriangleAlert,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  Wine,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import type { Alerts } from './alerts';
import { useAlerts } from './alerts-client';

export type NavItem = { label: string; icon: string; href: string; slug?: string };
export type NavGroup = { label: string; items: NavItem[] };
type Text = Record<'main' | 'dashboard' | 'viewSite' | 'account' | 'signOut' | 'closeMenu' | 'brandSub', string>;

const ICONS = {
  dashboard: LayoutDashboard,
  home: House,
  pages: FileText,
  events: CalendarDays,
  catering: UtensilsCrossed,
  happy: Wine,
  media: Images,
  legal: Scale,
  requests: ClipboardList,
  orders: ShoppingBag,
  reservations: CalendarCheck,
  bookings: Ticket,
  zones: MapPin,
  slots: Clock,
  settings: Settings,
  header: Menu,
  footer: PanelBottom,
  users: UsersRound,
  audit: ScrollText,
  account: UserRound,
  site: ExternalLink,
  logout: LogOut,
  docs: BookOpenText,
  products: Package,
  categories: Tags,
  producers: Store,
  lowStock: TriangleAlert,
  counts: ClipboardCheck,
  movements: ArrowLeftRight,
  groups: Contact,
};

function Item({ item, active, external, count }: { item: NavItem; active: boolean; external?: boolean; count?: number }) {
  const Icon = ICONS[item.icon as keyof typeof ICONS] ?? FileText;
  return (
    <Link
      href={item.href}
      className="gg-nav__item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className="gg-nav__chip">
        <Icon />
      </span>
      <span className="gg-nav__label">{item.label}</span>
      {count ? <span className="gg-nav__count">{count}</span> : null}
    </Link>
  );
}

const SCROLL_KEY = 'gg_nav_scroll';

export function NavClient({ groups, alerts: fresh, text }: { groups: NavGroup[]; alerts: Alerts; text: Text }) {
  const pathname = usePathname();
  const alerts = useAlerts(fresh);
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav();
  // Payload renders the sidebar again on every page, which would put it back at the top and hide the item just
  // clicked. Its scroll position is kept for the visit and restored before the page paints; the active item is then
  // brought into view if it is still outside.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem(SCROLL_KEY));
    if (saved) el.scrollTop = saved;
    el.querySelector<HTMLElement>('[data-active]')?.scrollIntoView({ block: 'nearest' });
    const remember = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
    el.addEventListener('scroll', remember, { passive: true });
    return () => el.removeEventListener('scroll', remember);
  }, [pathname, navRef]);
  const { getPreference } = usePreferences();
  // Payload closes the sidebar on load on any window up to 1440 px, which is most laptops. Like the LMS, it stays open
  // on every desktop width unless the user closed it; below 1025 px it remains Payload's slide-over menu.
  useEffect(() => {
    if (!hydrated || !window.matchMedia('(min-width: 1025px)').matches) return;
    void getPreference<{ open?: boolean }>('nav').then((pref) => setNavOpen(pref?.open !== false));
  }, [hydrated, getPreference, setNavOpen]);
  const isActive = (link: string) => {
    const href = link.split('?')[0];
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  // Payload's own classes keep its open/close behaviour; `gg-nav` restyles everything inside.
  const classes = ['nav', 'gg-nav', navOpen && 'nav--nav-open', shouldAnimate && 'nav--nav-animate', hydrated && 'nav--nav-hydrated'];

  return (
    <aside className={classes.filter(Boolean).join(' ')} inert={!navOpen || undefined}>
      <div className="nav__scroll gg-nav__scroll" ref={navRef}>
        <div className="gg-nav__top">
          <Link href="/admin" className="gg-nav__brand">
            <span className="gg-nav__brand-tile">
              <Image src="/brand/mark.png" alt="" width={223} height={240} />
            </span>
            <span className="gg-nav__brand-text">
              <span className="gg-nav__brand-name">
                Golden <b>Grape</b>
              </span>
              <span className="gg-nav__brand-sub">{text.brandSub}</span>
            </span>
          </Link>
          <button type="button" className="gg-nav__close" aria-label={text.closeMenu} onClick={() => setNavOpen(false)}>
            <X />
          </button>
        </div>

        <nav className="gg-nav__groups" aria-label={text.main}>
          <Item item={{ label: text.dashboard, icon: 'dashboard', href: '/admin' }} active={pathname === '/admin'} />
          {groups.map((group) => (
            <div key={group.label} className="gg-nav__group">
              <p className="gg-nav__group-label">{group.label}</p>
              {group.items.map((item) => (
                <Item key={item.href} item={item} active={isActive(item.href)} count={item.slug ? alerts?.counts[item.slug] : undefined} />
              ))}
            </div>
          ))}
        </nav>

        <div className="gg-nav__foot">
          <Item item={{ label: text.viewSite, icon: 'site', href: '/fr' }} active={false} external />
          <Item item={{ label: text.account, icon: 'account', href: '/admin/account' }} active={isActive('/admin/account')} />
          <Item item={{ label: text.signOut, icon: 'logout', href: '/admin/logout' }} active={false} />
        </div>
      </div>
    </aside>
  );
}
