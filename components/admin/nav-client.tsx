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
  ChevronDown,
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
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import type { Alerts } from './alerts';
import { useAlerts } from './alerts-client';

export type NavItem = { label: string; icon: string; href: string; slug?: string };
/** `id`: a stable key (the group's text key), so a section's open/closed choice survives a language change. */
export type NavGroup = { id: string; label: string; items: NavItem[] };
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

// Collapsible sections (GG-016). Each section's open/closed choice is kept in this browser; without a choice, only the
// section of the page being viewed is open. The store is localStorage itself, read through useSyncExternalStore.
const GROUPS_KEY = 'gg_nav_groups';
const LAST_PAGE_KEY = 'gg_nav_last_page';
const groupListeners = new Set<() => void>();
const readGroups = () => localStorage.getItem(GROUPS_KEY) ?? '{}';
/** A damaged value only loses the choices (every section back to its default), never the sidebar. */
function parseChoices(raw: string): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function subscribeGroups(listener: () => void) {
  groupListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    groupListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function setGroupOpen(id: string, open: boolean) {
  const choices = parseChoices(readGroups());
  localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...choices, [id]: open }));
  groupListeners.forEach((l) => l());
}

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
  const choices = parseChoices(useSyncExternalStore(subscribeGroups, readGroups, () => '{}'));
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href)))?.id;
  const isOpen = (id: string) => choices[id] ?? id === activeGroup;
  // Arriving on a page inside a closed section opens it once, so the page just opened is visible. Only on arrival:
  // the user can still close that section afterwards (its total then shows on the header).
  // A reload of the same page is not an arrival: a section closed there stays closed.
  useEffect(() => {
    const arrived = sessionStorage.getItem(LAST_PAGE_KEY) !== pathname;
    sessionStorage.setItem(LAST_PAGE_KEY, pathname);
    if (arrived && activeGroup && parseChoices(readGroups())[activeGroup] === false) setGroupOpen(activeGroup, true);
  }, [pathname, activeGroup]);
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
          {groups.map((group) => {
            const open = isOpen(group.id);
            const count = (item: NavItem) => (item.slug ? alerts?.counts[item.slug] : undefined);
            // A closed section still says how much waits inside it.
            const waiting = group.items.reduce((sum, i) => sum + (count(i) ?? 0), 0);
            return (
              <div key={group.id} className="gg-nav__group" data-open={open || undefined}>
                <button type="button" className="gg-nav__group-label" aria-expanded={open} aria-controls={`gg-nav-${group.id}`} onClick={() => setGroupOpen(group.id, !open)}>
                  <span>{group.label}</span>
                  {!open && waiting > 0 && <span className="gg-nav__count">{waiting}</span>}
                  <ChevronDown className="gg-nav__chevron" aria-hidden />
                </button>
                <div id={`gg-nav-${group.id}`} className="gg-nav__group-items" inert={!open || undefined}>
                  <div>
                    {group.items.map((item) => (
                      <Item key={item.href} item={item} active={isActive(item.href)} count={count(item)} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
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
