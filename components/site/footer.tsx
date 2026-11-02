import { ArrowUp, Mail, MapPin, Phone } from 'lucide-react';
import { cacheLife } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { type Dictionary, interpolate } from '@/lib/i18n';
import { type NavItem, NavLink } from './nav-link';
import { FacebookIcon, InstagramIcon } from './social-icons';

async function currentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

type Business = { street: string; postalCode: string; city: string; phone?: string | null; email?: string | null; instagram?: string | null; facebook?: string | null };
type Props = {
  t: Dictionary['footer'];
  tagline?: string | null;
  columns: { title: string; items: NavItem[] }[];
  business: Business;
  legal: NavItem[];
  hours: { days: string; slots: string }[];
  hoursLabel: string;
  directions: { label: string; href: string };
  reserve: { label: string; href: string };
};

const circle = 'grid h-10 w-10 place-items-center rounded-full border border-bone/15 transition hover:border-gold hover:text-gold';
const linkClass = 'transition-colors hover:text-gold';
const heading = 'eyebrow text-gold';
const list = 'mt-6 space-y-3 text-sm font-light';

export async function Footer({ t, tagline, columns, business, legal, hours, hoursLabel, directions, reserve }: Props) {
  const year = await currentYear();
  const external = { target: '_blank', rel: 'noopener noreferrer' };
  return (
    <footer className="relative overflow-hidden bg-ink text-bone/70">
      <div className="bg-azulejo h-24 border-b border-gold/15 opacity-30" aria-hidden="true" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        {/* "Bem-vindo": the Portuguese welcome that closes the Story quote, in every language of the site. */}
        <div className="flex flex-col gap-8 border-b border-bone/10 py-14 md:flex-row md:items-end md:justify-between md:py-20">
          <p lang="pt" className="text-gold-gradient pb-[0.12em] font-serif text-[clamp(3.75rem,10vw,9rem)] leading-none font-light italic">
            Bem-vindo.
          </p>
          <Button asChild variant="goldGlass" size="lg" className="shrink-0 self-start md:mb-6 md:self-auto">
            <Link href={reserve.href}>
              {reserve.label}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-12 border-b border-bone/10 py-16 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-4">
            <Image src="/brand/logo-light.png" alt="Golden Grape · Mäi Wäin" width={1085} height={859} sizes="162px" className="h-24 w-auto md:h-32" />
            {tagline && <p className="mt-6 max-w-xs text-sm leading-relaxed font-light">{tagline}</p>}
            <div className="mt-6 flex items-center gap-3">
              {business.instagram && (
                <a href={business.instagram} aria-label="Instagram" className={circle} {...external}>
                  <InstagramIcon className="h-4 w-4" />
                </a>
              )}
              {business.facebook && (
                <a href={business.facebook} aria-label="Facebook" className={circle} {...external}>
                  <FacebookIcon className="h-4 w-4" />
                </a>
              )}
              {business.email && (
                <a href={`mailto:${business.email}`} aria-label={business.email} className={circle}>
                  <Mail className="h-4 w-4" />
                </a>
              )}
              {business.phone && (
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} aria-label={business.phone} className={circle}>
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h4 className={heading}>{col.title}</h4>
              <ul className={list}>
                {col.items.map((item) => (
                  <li key={item.label}>
                    <NavLink item={item} className={item.href ? linkClass : undefined} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-2">
            <h4 className={heading}>{t.colContact}</h4>
            <ul className={`${list} break-words`}>
              {business.street && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-1 h-3 w-3 shrink-0 text-gold/70" />
                  <span>
                    <span className="block">{business.street}</span>
                    <span className="block whitespace-nowrap">
                      L-{business.postalCode} {business.city}
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
              <li>
                <a href={directions.href} className="border-b border-gold/50 pb-0.5 text-gold transition-colors hover:border-gold" {...external}>
                  {directions.label} →
                </a>
              </li>
            </ul>
          </div>

          {hours.length > 0 && (
            <div className="lg:col-span-2">
              <h4 className={heading}>{hoursLabel}</h4>
              <ul className={list}>
                {hours.map((h) => (
                  <li key={h.days}>
                    <span className="block">{h.days}</span>
                    <span className="block text-bone/50 tabular-nums">{h.slots}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 py-8 text-center text-[10px] tracking-[0.2em] text-bone/45 uppercase lg:flex-row lg:text-left">
          <span>{interpolate(t.rights, { year })}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {legal.map((item) => (
              <NavLink key={item.label} item={item} className={item.href ? 'transition hover:text-gold' : undefined} />
            ))}
            <span>{t.moderation}</span>
            <a href="#top" aria-label={t.backToTop} className="grid h-9 w-9 place-items-center rounded-full border border-bone/15 text-bone/70 transition hover:border-gold hover:text-gold">
              <ArrowUp className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
