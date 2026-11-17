import { type Dictionary, interpolate } from '@/lib/i18n';
import { colors, heading, MailLayout, type MailBusiness } from './layout';

export type GiftCardMail = { name: string; amount: string; date: string; code: string };

/** A gift card sold online (M3.2 T3): the amount, the code in groups of four and its QR (an inline image, `cid:qr`). */
export function GiftCardEmail({
  t,
  business,
  logoUrl,
  card,
}: {
  t: Dictionary['mail'];
  business: MailBusiness;
  logoUrl: string;
  card: GiftCardMail;
}) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <p>{interpolate(t.greeting, { name: card.name })}</p>
      <h1 style={heading}>{interpolate(t.giftCard.subject, { amount: card.amount })}</h1>
      <p>{interpolate(t.giftCard.intro, { amount: card.amount, date: card.date })}</p>
      <table
        cellPadding={0}
        cellSpacing={0}
        style={{ width: '100%', margin: '24px 0', background: colors.champagne, borderRadius: 12 }}
      >
        <tbody>
          <tr>
            <td style={{ padding: 24, textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- e-mail HTML: next/image cannot run in a mail client */}
              <img src="cid:qr" width={160} height={160} alt="" style={{ display: 'block', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 12, color: colors.muted, letterSpacing: 2, textTransform: 'uppercase' }}>
                {t.giftCard.code}
              </div>
              <div style={{ fontSize: 24, fontFamily: 'Menlo, Consolas, monospace', letterSpacing: 2, marginTop: 6 }}>
                {card.code}
              </div>
              <div style={{ fontSize: 28, color: colors.goldDeep, marginTop: 10 }}>{card.amount}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <p>{t.giftCard.how}</p>
      <p style={{ color: colors.muted, fontSize: 13 }}>{t.giftCard.balance}</p>
      <p>{t.signature}</p>
    </MailLayout>
  );
}
