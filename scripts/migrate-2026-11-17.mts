// One-off for the M3.1–M3.3 release (17 Nov 2026); safe to run again. `--check` only reports.
// A customer's payment term was free text before M3.2 and is now a number of days ("0" on receipt, 8, 15, 30, 45, 60):
// a typed term ("30 jours", "Net 45") takes the nearest allowed value at or above the days it names, an empty or
// unreadable one "0". Without this, saving such a customer in the admin is refused (not one of the choices).
// Run: npm run migrate:2026-11-17 -- --check
import { getPayload } from 'payload';
import { model } from '@/lib/tx';

const ALLOWED = [0, 8, 15, 30, 45, 60];
const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });

const customers = model(payload, 'customers');
const odd = await customers.find({ paymentTerm: { $exists: true, $nin: ALLOWED.map(String) } }, { paymentTerm: 1, name: 1, company: 1 }).lean<{ _id: unknown; paymentTerm: unknown; name?: string; company?: string }[]>();
for (const c of odd) {
  const days = Number.parseInt(String(c.paymentTerm ?? '').replace(/\D+/g, ' ').trim().split(' ')[0] ?? '', 10);
  const to = String(Number.isFinite(days) ? (ALLOWED.find((a) => a >= days) ?? 60) : 0);
  console.info(`[paymentTerm] ${c.company || c.name}: "${String(c.paymentTerm)}" → ${to}`);
  if (!check) await customers.updateOne({ _id: c._id }, { $set: { paymentTerm: to } });
}
console.info(`${check ? 'Would change' : 'Changed'} ${odd.length} customer(s).`);
process.exit(0);
