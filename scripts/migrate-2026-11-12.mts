// One-off for APPLUX's test report 4 (12 Nov 2026, §4); safe to run again. `--check` only reports.
// Event bookings get their payment apart from their status: the single `payment` recorded before 12 Nov becomes the
// first row of `payments`, with `paidCents`, `refundedCents` and `paymentStatus`; the history lines written with the
// old field names ("payment.amountCents"…) take the new ones, so the history keeps its labels.
// Run: npm run migrate:2026-11-12 -- --check
import { getPayload } from 'payload';
import { model } from '@/lib/tx';
import { bookingPaymentStatus } from '@/modules/events/service';

type Old = { _id: unknown; amountCents?: number; paidCents?: number; refundedCents?: number; paymentStatus?: string; payments?: unknown[]; updatedAt?: Date; payment?: { amountCents?: number; at?: Date; method?: string; reference?: string; user?: unknown } };

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
// The raw collection: `payment` is no longer in the schema, so Payload's own reads would not return it.
const bookings = model(payload, 'eventBookings').collection;

let moved = 0;
for await (const b of bookings.find<Old>({ $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: null }, { payment: { $exists: true } }] })) {
  // A row id like Payload's own (the hex text of an ObjectId, kept as `id`), made with the driver's class of the
  // booking's id: no new dependency.
  const ObjectId = (b._id as { constructor: new () => unknown }).constructor;
  const old = b.payment?.amountCents ? b.payment : null;
  const payments = b.payments?.length ? b.payments : old ? [{ id: String(new ObjectId()), kind: 'charge', amountCents: old.amountCents, at: old.at, method: old.method, reference: old.reference, user: old.user, notedAt: b.updatedAt }] : [];
  const paidCents = b.paidCents || old?.amountCents || 0;
  const refundedCents = b.refundedCents ?? 0;
  const paymentStatus = bookingPaymentStatus({ amountCents: b.amountCents, paidCents, refundedCents });
  console.info(`[eventBookings] ${String(b._id)} → ${paymentStatus}, received ${paidCents / 100} € of ${(b.amountCents ?? 0) / 100} €${old ? ' (payment moved to a row)' : ''}`);
  if (!check) await bookings.updateOne({ _id: b._id as never }, { $set: { payments, paidCents, refundedCents, paymentStatus }, $unset: { payment: '' } });
  moved++;
}

const KEYS = ['amountCents', 'at', 'method', 'reference'];
const logs = model(payload, 'auditLogs').collection;
let renamed = 0;
for await (const log of logs.find<{ _id: unknown; after?: Record<string, unknown> }>({ action: 'booking.payment' })) {
  const after = log.after ?? {};
  if (!KEYS.some((k) => `payment.${k}` in after)) continue;
  const next = Object.fromEntries(Object.entries(after).map(([k, v]) => [k.replace(/^payment\./, 'payments.'), v]));
  if (!check) await logs.updateOne({ _id: log._id as never }, { $set: { after: next } });
  renamed++;
}

// Shop details: the single IBAN/BIC of before becomes the first (default) bank account.
const globals = payload.db.connection.collection('globals');
const shop = await globals.findOne<{ _id: unknown; business?: { iban?: string; bic?: string; legalName?: string; name?: string; bankAccounts?: unknown[] } }>({ globalType: 'BusinessSettings' });
const oldIban = shop?.business?.iban;
if (shop && (oldIban || shop.business?.bic !== undefined)) {
  const first = oldIban && !shop.business?.bankAccounts?.length ? [{ id: String(new (shop._id as { constructor: new () => unknown }).constructor()), holder: shop.business?.legalName || shop.business?.name, iban: oldIban, bic: shop.business?.bic, active: true, isDefault: true }] : null;
  console.info(`[settings] ${first ? 'the IBAN becomes the first bank account' : 'old IBAN/BIC fields removed (none saved)'}`);
  if (!check) await globals.updateOne({ _id: shop._id as never }, { ...(first ? { $set: { 'business.bankAccounts': first } } : {}), $unset: { 'business.iban': '', 'business.bic': '' } });
}

console.info(`[migrate] ${moved} booking(s) and ${renamed} history line(s)${check ? ' to update (check only)' : ' updated'}`);
await payload.destroy();
process.exit(0);
