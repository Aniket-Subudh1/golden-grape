import { CalendarDays, Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { Container } from '@/components/site/container';
import { JsonLd } from '@/components/site/json-ld';
import { PageHero } from '@/components/site/page-hero';
import { FacebookIcon, InstagramIcon } from '@/components/site/social-icons';
import { Button } from '@/components/ui/button';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale, localePath } from '@/lib/i18n';
import { weekHours } from '@/lib/time';
import { ContactForm } from '@/modules/cms/components/contact-form';
import { getHomePage, mediaOf } from '@/modules/cms/service';
import { TABLE_BOOKING } from '@/modules/sales/order-states';
import { localBusinessJsonLd } from '@/modules/settings/seo';
import { directionsUrl, getSettings } from '@/modules/settings/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.contact, alternates: alternates('/contact', locale) };
}

/** The shop interior from the Home page settings (shared with the home page's "Store" section). */
async function ShopPhoto({ locale }: { locale: Locale }) {
  const photo = mediaOf((await getHomePage(locale)).photos?.interior);
  return photo ? <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /> : null;
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-2 flex items-center gap-2 text-gold-deep">
        {icon}
        {label}
      </div>
      <div className="text-sm leading-relaxed font-light text-ink/80">{children}</div>
    </div>
  );
}

const iconCircle = 'grid h-10 w-10 place-items-center rounded-full border border-border transition hover:border-gold-deep hover:text-gold-deep';
const link = 'transition hover:text-gold-deep';

async function Info({ locale, t }: { locale: Locale; t: Dictionary['contactPage'] }) {
  const settings = await getSettings();
  const { business: b, hours } = settings;
  if (!b?.street) return null; // BusinessSettings not filled in yet
  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings, localePath(locale, '/contact'))} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <InfoRow icon={<MapPin className="h-4 w-4" />} label={t.info.address}>
          {b.street}
          <br />
          L-{b.postalCode} {b.city}
          {b.country && `, ${b.country}`}
        </InfoRow>
        {b.phone && (
          <InfoRow icon={<Phone className="h-4 w-4" />} label={t.info.phone}>
            <a href={`tel:${b.phone.replace(/\s/g, '')}`} className={link}>
              {b.phone}
            </a>
          </InfoRow>
        )}
        {b.email && (
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t.info.email}>
            <a href={`mailto:${b.email}`} className={link}>
              {b.email}
            </a>
          </InfoRow>
        )}
        <InfoRow icon={<Clock className="h-4 w-4" />} label={t.info.hours}>
          <ul className="space-y-1">
            {weekHours(hours, locale).map((h) => (
              <li key={h.day} className="flex justify-between gap-4">
                <span>{h.day}</span>
                <span className="text-ink/50 tabular-nums">{h.slots || t.closed}</span>
              </li>
            ))}
          </ul>
        </InfoRow>
      </div>
      {(b.instagram || b.facebook) && (
        <div className="flex items-center gap-4 pt-2">
          {b.instagram && (
            <a href={b.instagram} aria-label="Instagram" className={iconCircle} target="_blank" rel="noopener noreferrer">
              <InstagramIcon className="h-4 w-4" />
            </a>
          )}
          {b.facebook && (
            <a href={b.facebook} aria-label="Facebook" className={iconCircle} target="_blank" rel="noopener noreferrer">
              <FacebookIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </>
  );
}

/** Where to find us: the address and a real directions button, compact (APPLUX §4: no large decorative band). */
async function Location({ caption, directions }: { caption: string; directions: string }) {
  const { business: b } = await getSettings();
  if (!b?.street) return null;
  return (
    <div className="relative overflow-hidden border border-border bg-ink text-bone">
      <div className="bg-azulejo pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-start gap-4">
          <MapPin className="mt-1 h-6 w-6 shrink-0 text-gold" />
          <div>
            <p className="text-[11px] tracking-[0.3em] text-bone/50 uppercase">{caption}</p>
            <p className="mt-2 font-serif text-2xl md:text-3xl">
              {b.street}
              <span className="hidden md:inline"> · </span>
              <span className="block whitespace-nowrap md:inline">
                L-{b.postalCode} {b.city}
              </span>
            </p>
          </div>
        </div>
        <Button asChild variant="goldGlass" size="md" className="shrink-0 self-start md:self-auto">
          <a href={directionsUrl(b)} target="_blank" rel="noopener noreferrer">
            {directions}
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
        </Button>
      </div>
    </div>
  );
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { contactPage: t, form, store, cart } = await getDictionary(locale);
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={[t.titleA, t.titleB]} subtitle={t.subtitle} />
      <section className="pb-12 md:pb-16">
        <Container className="grid gap-10 px-6 md:gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="relative aspect-[4/3] overflow-hidden bg-ink">
              <Suspense fallback={null}>
                <ShopPhoto locale={locale} />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <Info locale={locale} t={t} />
            </Suspense>
          </div>
          <div className="space-y-6">
            {/* Table bookings have their own form; this page is for questions (APPLUX §3). */}
            <div className="flex flex-col gap-4 border border-gold/40 bg-ink px-6 py-5 text-bone sm:flex-row sm:items-center sm:justify-between md:px-8">
              <p className="text-sm leading-relaxed font-light text-bone/80">{t.tableNote}</p>
              <Button asChild variant="goldGlass" size="sm" className="shrink-0 self-start px-4 tracking-[0.2em] sm:self-auto">
                <Link href={localePath(locale, TABLE_BOOKING)}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {cart.bookTable}
                </Link>
              </Button>
            </div>
            <div className="border border-border bg-champagne/40 p-6 md:p-10">
              <ContactForm t={t.form} form={form} locale={locale} />
            </div>
          </div>
        </Container>
      </section>
      <section className="pb-16">
        <Container className="px-6">
          <Suspense fallback={null}>
            <Location caption={t.mapCaption} directions={store.directions} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
