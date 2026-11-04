'use client';

import { useNav, usePreferences } from '@payloadcms/ui';
import {
  ArrowLeftRight,
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
import { useEffect } from 'react';

export type NavItem = { label: string; icon: string; href: string };
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

function Item({ item, active, external }: { item: NavItem; active: boolean; external?: boolean }) {
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
    </Link>
  );
}

export function NavClient({ groups, text }: { groups: NavGroup[]; text: Text }) {
  const pathname = usePathname();
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav();
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
                <Item key={item.href} item={item} active={isActive(item.href)} />
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
