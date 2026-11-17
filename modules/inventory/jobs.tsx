import type { Payload } from 'payload';
import { appUrl } from '@/lib/env';
import { interpolate } from '@/lib/i18n';
import { render, sendMail } from '@/lib/mail';
import { mailContext } from '@/modules/notifications/context';
import { LowStockDigest } from '@/modules/notifications/templates/low-stock';
import { reorderList } from '@/modules/purchasing/service';
import { getSettingsPrivate } from '@/modules/settings/service';

/**
 * `low-stock-digest` (M3.1 T6, daily at 07:00 Luxembourg from the host's cron): one e-mail to Réglages › Alertes ›
 * "E-mail du stock bas" (else the staff inbox) listing every size at or below its level, with on hand, level and
 * supplier. Nothing is sent when nothing is low.
 */
export async function lowStockDigest(payload: Payload) {
  const [rows, settings, ctx] = await Promise.all([reorderList(payload, 'fr'), getSettingsPrivate(), mailContext('fr')]);
  const to = settings.alerts?.lowStockEmail || ctx.staffTo;
  if (rows.length === 0) return { sent: false, count: 0, reason: 'nothing low' };
  if (!to) return { sent: false, count: rows.length, reason: 'no address' };
  const t = ctx.staffT;
  const mail = await render(
    <LowStockDigest
      t={t}
      business={ctx.business}
      logoUrl={ctx.logoUrl}
      link={`${appUrl()}/staff/reorder`}
      rows={rows.map((r) => ({
        name: r.name,
        sku: r.sku,
        onHand: r.onHand,
        threshold: r.threshold,
        supplier: r.offer?.supplier?.name ?? null,
        suggestion: interpolate(t.lowStock.suggest, { what: r.offer?.unit ? `${r.suggested} × ${r.offer.unit.label}` : `${r.suggested} ${t.lowStock.units}` }),
      }))}
    />,
  );
  await sendMail({ to, subject: interpolate(t.lowStock.subject, { count: rows.length }), ...mail });
  return { sent: true, count: rows.length, to };
}
