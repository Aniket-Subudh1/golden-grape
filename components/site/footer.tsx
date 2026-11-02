import { Mail, MapPin } from 'lucide-react';
import { cacheLife } from 'next/cache';
import Image from 'next/image';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { type NavItem, NavLink } from './nav-link';
import { FacebookIcon, InstagramIcon } from './social-icons';

async function currentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

type Business = {
  street: string;
  postalCode: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
};
type Props = {
  t: Dictionary['footer'];
  tagline?: string | null;
  columns: { title: string; items: NavItem[] }[];
  contactTitle: string;
  business: Business;
  legal: NavItem[];
};

const circle =
  'grid h-9 w-9 place-items-center rounded-full border border-bone/15 transition hover:border-gold hover:text-gold';

export async function Footer({ t, tagline, columns, contactTitle, business, legal }: Props) {
  const year = await currentYear();
  const linkClass = 'transition-colors hover:text-gold';
  const socials = [
    business.instagram && { href: business.instagram, label: 'Instagram', icon: <InstagramIcon className="h-4 w-4" /> },
    business.facebook && { href: business.facebook, label: 'Facebook', icon: <FacebookIcon className="h-4 w-4" /> },
    business.email && { href: `mailto:${business.email}`, label: 'E-mail', icon: <Mail className="h-4 w-4" /> },
  ].filter((s) => !!s);

  return (
    <footer className="bg-ink text-bone/70 pt-24 pb-10">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="border-bone/10 grid grid-cols-2 gap-12 border-b pb-16 md:grid-cols-5">
          <div className="col-span-2">
            <Image
              src="/brand/logo-light.png"
              alt="Golden Grape · Mäi Wäin"
              width={1200}
              height={1200}
              sizes="112px"
              className="h-24 w-auto md:h-28"
            />
            {tagline && <p className="mt-6 max-w-xs text-sm leading-relaxed font-light">{tagline}</p>}
            {socials.length > 0 && (
              <div className="mt-6 flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className={circle}
                    target={s.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
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
            <h4 className="eyebrow text-gold">{contactTitle}</h4>
            <ul className="mt-6 space-y-3 text-sm font-light break-words">
              {business.street && (
                <li>
                  <span className="inline-flex items-start gap-2">
                    <MapPin className="text-gold/70 mt-1 h-3 w-3 shrink-0" />
                    <span>
                      {business.street} · L-{business.postalCode} {business.city}
                    </span>
                  </span>
                </li>
              )}
              {business.phone && (
                <li>
                  <a href={`tel:${business.phone.replace(/\s/g, '')}`} className={linkClass}>
                    {business.phone}
                  </a>
                </li>
              )}
              {business.email && (
                <li>
                  <a href={`mailto:${business.email}`} className={linkClass}>
                    {business.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="text-bone/40 flex flex-col items-center justify-between gap-4 pt-8 text-[11px] tracking-[0.25em] uppercase md:flex-row">
          <span>{interpolate(t.rights, { year })}</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {legal.map((item) => (
              <NavLink key={item.label} item={item} className="hover:text-gold transition" />
            ))}
            <span>{t.moderation}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
