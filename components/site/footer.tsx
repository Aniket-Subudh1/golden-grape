import { MapPin } from 'lucide-react';
import { cacheLife } from 'next/cache';
import Image from 'next/image';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { type NavItem, NavLink } from './nav-link';

// Business contact details move to BusinessSettings in M1.3.
const ADDRESS = '25 Zac Klengbousbierg · L-7795 Bissen';
const PHONE = { label: '+352 691 855 844', href: 'tel:+352691855844' };
const EMAIL = { label: 'hello@goldengrape.lu', href: 'mailto:hello@goldengrape.lu' };

async function currentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

type Props = { t: Dictionary['footer']; columns: { title: string; items: NavItem[] }[] };

export async function Footer({ t, columns }: Props) {
  const year = await currentYear();
  const linkClass = 'transition-colors hover:text-gold';
  return (
    <footer className="bg-ink pt-24 pb-10 text-bone/70">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="grid grid-cols-2 gap-12 border-b border-bone/10 pb-16 md:grid-cols-5">
          <div className="col-span-2">
            <Image
              src="/brand/logo-light.png"
              alt="Golden Grape · Mäi Wäin"
              width={1200}
              height={1200}
              sizes="112px"
              className="h-24 w-auto md:h-28"
            />
            <p className="mt-6 max-w-xs text-sm leading-relaxed font-light">{t.tagline}</p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="eyebrow text-gold">{col.title}</h4>
              <ul className="mt-6 space-y-3 text-sm font-light">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <NavLink item={item} className={item.href ? linkClass : undefined} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="eyebrow text-gold">{t.colContact}</h4>
            <ul className="mt-6 space-y-3 text-sm font-light break-words">
              <li>
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-1 h-3 w-3 shrink-0 text-gold/70" />
                  <span>{ADDRESS}</span>
                </span>
              </li>
              {[PHONE, EMAIL].map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-[11px] tracking-[0.25em] text-bone/40 uppercase md:flex-row">
          <span>{interpolate(t.rights, { year })}</span>
          <span>{t.moderation}</span>
        </div>
      </div>
    </footer>
  );
}
