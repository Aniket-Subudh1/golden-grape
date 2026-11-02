import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { Container } from '@/components/site/container';
import { PageHero } from '@/components/site/page-hero';
import { FacebookIcon, InstagramIcon } from '@/components/site/social-icons';
import { storeInterior } from '@/lib/brand';
import { alternates, type Dictionary, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { weekHours } from '@/lib/time';
import { getSettings } from '@/modules/settings/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getDictionary(locale);
  return { ...meta.contact, alternates: alternates('/contact', locale) };
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
  const { business: b, hours } = await getSettings();
  if (!b?.street) return null; // BusinessSettings not filled in yet
  return (
    <>
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

async function MapBlock({ caption }: { caption: string }) {
  const { business: b } = await getSettings();
  if (!b?.street) return null;
  const address = `${b.street} · L-${b.postalCode} ${b.city}`;
  const href = b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.street}, ${b.postalCode} ${b.city}, Luxembourg`)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group relative grid aspect-[21/9] place-items-center overflow-hidden border border-border bg-ink/90 text-center text-bone/80">
      <div>
        <MapPin className="mx-auto h-8 w-8 text-gold" />
        <p className="mt-3 font-serif text-2xl transition group-hover:text-gold">{address}</p>
        <p className="mt-2 text-[11px] tracking-[0.3em] text-bone/50 uppercase">{caption}</p>
      </div>
    </a>
  );
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { contactPage: t } = await getDictionary(locale);
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={[t.titleA, t.titleB]} subtitle={t.subtitle} />
      <section className="pb-24 md:pb-32">
        <Container className="grid gap-10 px-6 md:gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src={storeInterior} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <Suspense fallback={null}>
              <Info locale={locale} t={t} />
            </Suspense>
          </div>
        </Container>
      </section>
      <section className="pb-24">
        <Container className="px-6">
          <Suspense fallback={null}>
            <MapBlock caption={t.mapCaption} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
