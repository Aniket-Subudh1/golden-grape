import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';

// The home page's last section (client request 17 Nov): the shop's contact details, nothing more. A light page between
// the dark banners and the dark footer: the photo (Home page settings) beside the name and town set large, the
// details as ruled lines, two actions.

type Props = {
  t: Dictionary['home']['contact'];
  labels: Dictionary['contactPage']['info'];
  photo?: { src: string; alt: string } | null;
  city: string;
  address: string[];
  phone?: string | null;
  email?: string | null;
  hours: { days: string; slots: string }[];
  directions: { label: string; href: string };
  contactHref: string;
};

const link = 'transition hover:text-gold-deep';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-ink/10 grid gap-2 border-t py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
      <dt className="eyebrow text-ink/45 pt-1">{label}</dt>
      <dd className="text-ink text-[17px] leading-relaxed font-light">{children}</dd>
    </div>
  );
}

export function HomeContact({ t, labels, photo, city, address, phone, email, hours, directions, contactHref }: Props) {
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-12 lg:gap-16 lg:py-32">
        {/* No photo chosen (Home page settings): no empty frame, the details stand alone. */}
        {photo && (
          <div className="group bg-champagne relative aspect-[4/3] overflow-hidden sm:aspect-[16/10] lg:col-span-6 lg:aspect-[4/5]">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.03]"
            />
          </div>
        )}
        <div className={photo ? 'lg:col-span-6 lg:pl-4' : 'lg:col-span-8 lg:col-start-3'}>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2 className="mt-5 font-serif text-[clamp(2.75rem,6vw,5rem)] leading-[0.95] font-light">
            {t.title}
            <em className="text-gold-deep block font-light italic">{city}</em>
          </h2>
          <dl className="border-ink/10 mt-10 border-b">
            <Row label={labels.address}>
              {address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </Row>
            {phone && (
              <Row label={labels.phone}>
                <a href={`tel:${phone.replace(/\s/g, '')}`} className={link}>
                  {phone}
                </a>
              </Row>
            )}
            {email && (
              <Row label={labels.email}>
                <a href={`mailto:${email}`} className={`${link} break-words`}>
                  {email}
                </a>
              </Row>
            )}
            <Row label={labels.hours}>
              {hours.map((h) => (
                <span key={h.days} className="flex flex-wrap justify-between gap-x-6">
                  <span>{h.days}</span>
                  <span className="text-ink/55 tabular-nums">{h.slots}</span>
                </span>
              ))}
            </Row>
          </dl>
          {/* Wraps when the two labels do not fit side by side (German at 1024 px scrolled the page sideways). */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild variant="solid" size="lg">
              <a href={directions.href} target="_blank" rel="noopener noreferrer">
                {directions.label}
                <span aria-hidden="true">→</span>
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={contactHref}>{t.write}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
