import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { type Dictionary, getDictionary, interpolate, isLocale, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { getPayloadClient } from '@/lib/payload';
import { currentCustomer } from '@/modules/customers/service';
import { GiftCardCheck } from '@/modules/promotions/components/gift-card-check';
import { getSettingsPrivate } from '@/modules/settings/service';

export async function generateMetadata({ params }: PageProps<'/[locale]/account/rewards'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return { title: `${account.nav.rewards} · Golden Grape`, robots: { index: false } };
}

/** "Points et cartes" (M3.2 T3): the points balance, its value and history; a gift card's balance by its code. */
async function Rewards({ locale, t }: { locale: Locale; t: Dictionary['account']['rewards'] }) {
  const customer = await currentCustomer();
  if (!customer) return null; // the layout shows the signed-out panel
  const payload = await getPayloadClient();
  const [settings, { docs }] = await Promise.all([
    getSettingsPrivate(),
    payload.find({
      collection: 'loyaltyLedger',
      where: { customer: { equals: customer.id } },
      sort: '-createdAt',
      limit: 30,
      depth: 1,
      overrideAccess: true,
      pagination: false,
    }),
  ]);
  const loyaltyOn = settings.modules?.loyalty === true;
  const points = customer.loyaltyBalance ?? 0;
  const value = settings.loyalty?.pointValueCents ?? 5;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Luxembourg' });
  return (
    <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
      {loyaltyOn && (
        <section>
          <h2 className="mb-6 flex items-center gap-3 font-serif text-3xl">
            <Sparkles className="text-gold-deep h-5 w-5" /> {t.title}
          </h2>
          <div className="bg-champagne/60 rounded-2xl p-6">
            <p className="font-serif text-5xl tabular-nums" data-testid="points">
              {interpolate(t.balance, { points })}
            </p>
            <p className="text-ink/65 mt-2 text-sm">
              {points > 0
                ? interpolate(t.worth, {
                    value: formatMoney(points * value, locale),
                    months: settings.loyalty?.expiryMonths ?? 24,
                  })
                : t.none}
            </p>
          </div>
          {docs.length > 0 && (
            <>
              <h3 className="eyebrow text-ink/60 mt-10 mb-3">{t.history}</h3>
              <ul className="divide-border/60 border-border/60 divide-y border-y">
                {docs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span>
                      <span className="block">{t.types[(r.type ?? 'adjust') as keyof typeof t.types]}</span>
                      <span className="text-ink/50 text-xs">
                        {day.format(new Date(r.createdAt))}
                        {typeof r.order === 'object' && r.order?.number
                          ? ` · ${interpolate(t.order, { number: r.order.number })}`
                          : ''}
                      </span>
                    </span>
                    <span className={`tabular-nums ${r.points > 0 ? 'text-gold-deep' : 'text-ink/60'}`}>
                      {r.points > 0 ? `+${r.points}` : r.points}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {settings.modules?.giftCards === true && (
        <section>
          <GiftCardCheck t={t} locale={locale} />
        </section>
      )}
    </div>
  );
}

export default async function RewardsPage({ params }: PageProps<'/[locale]/account/rewards'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = await getDictionary(locale);
  return (
    <Suspense>
      <Rewards locale={locale} t={account.rewards} />
    </Suspense>
  );
}
