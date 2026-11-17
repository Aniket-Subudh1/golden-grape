import type { Payload } from 'payload';
import QRCode from 'qrcode';
import { interpolate, type Locale } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { mailContext } from '@/modules/notifications/context';
import { GiftCardEmail } from '@/modules/notifications/templates/gift-card';
import { groupCode } from './codes';

/**
 * The e-mail of each gift card an order issued and not yet sent (after commit; called again it sends nothing): the
 * code and its QR (an inline PNG, which mail clients show, unlike a data: URL), in the buyer's language.
 */
export async function mailGiftCards(payload: Payload, orderId: string) {
  const { docs } = await payload.find({
    collection: 'giftCards',
    where: { order: { equals: orderId }, mailedAt: { exists: false } },
    depth: 0,
    limit: 50,
    overrideAccess: true,
    pagination: false,
  });
  for (const card of docs) {
    if (!card.recipientEmail || !card.code) continue;
    const locale = (card.locale ?? 'fr') as Locale;
    const ctx = await mailContext(locale);
    const amount = formatMoney(card.initialCents, locale);
    const date = card.expiresAt
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(
          new Date(card.expiresAt),
        )
      : '—';
    const mail = await render(
      <GiftCardEmail
        t={ctx.customerT}
        business={ctx.business}
        logoUrl={ctx.logoUrl}
        card={{ name: card.recipientName ?? '', amount, date, code: groupCode(card.code) }}
      />,
    );
    const qr = await QRCode.toBuffer(card.code, { type: 'png', width: 320, margin: 1 });
    await sendMail({
      to: card.recipientEmail,
      subject: interpolate(ctx.customerT.giftCard.subject, { amount }),
      ...mail,
      attachments: [{ filename: 'gift-card.png', content: qr, contentType: 'image/png', cid: 'qr' }],
    });
    await payload.update({
      collection: 'giftCards',
      id: card.id,
      data: { mailedAt: new Date().toISOString() },
      overrideAccess: true,
      context: { byService: true },
      depth: 0,
    });
  }
  return docs.length;
}
