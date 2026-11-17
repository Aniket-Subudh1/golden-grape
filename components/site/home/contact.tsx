import Link from 'next/link';
import { Reveal } from '@/components/site/reveal';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';

// The home page's last section (client request 17 Nov): the shop's contact details, nothing more.

type Props = {
  t: Dictionary['home']['contact'];
  labels: Dictionary['contactPage']['info'];
  address: string[];
  phone?: string | null;
  email?: string | null;
  hours: { days: string; slots: string }[];
  directions: { label: string; href: string };
  contactHref: string;
};

const link = 'transition hover:text-gold';

export function HomeContact({ t, labels, address, phone, email, hours, directions, contactHref }: Props) {
  return (
    <section className="bg-ink px-6 py-20 text-bone md:py-32">
      <Reveal className="mx-auto max-w-5xl text-center">
        <span className="eyebrow text-gold">{t.eyebrow}</span>
        <h2 className="mt-5 font-serif text-4xl leading-none font-light tracking-[0.04em] uppercase md:text-6xl">{t.title}</h2>
        <dl className="mt-14 grid gap-10 text-sm font-light sm:grid-cols-2 md:grid-cols-4">
          <div>
            <dt className="eyebrow text-bone/50">{labels.address}</dt>
            <dd className="mt-3">
              {address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </dd>
          </div>
          {phone && (
            <div>
              <dt className="eyebrow text-bone/50">{labels.phone}</dt>
              <dd className="mt-3">
                <a href={`tel:${phone.replace(/\s/g, '')}`} className={link}>
                  {phone}
                </a>
              </dd>
            </div>
          )}
          {email && (
            <div>
              <dt className="eyebrow text-bone/50">{labels.email}</dt>
              <dd className="mt-3 break-words">
                <a href={`mailto:${email}`} className={link}>
                  {email}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="eyebrow text-bone/50">{labels.hours}</dt>
            <dd className="mt-3 space-y-2">
              {hours.map((h) => (
                <span key={h.days} className="block">
                  <span className="block">{h.days}</span>
                  <span className="block text-bone/60">{h.slots}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <Button asChild variant="goldGlass" size="md">
            <a href={directions.href} target="_blank" rel="noopener noreferrer">
              {directions.label}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </Button>
          <Link href={contactHref} className="border-b border-transparent pb-1 text-[11px] tracking-[0.3em] text-bone/70 uppercase transition hover:border-gold hover:text-gold">
            {t.write}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
