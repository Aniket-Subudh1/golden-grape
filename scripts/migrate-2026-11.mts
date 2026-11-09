// One-off for APPLUX's test report of 9 Nov 2026; safe to run again. `--check` only reports.
// 1. Reference formats still on their old default (ORD-, REQ-, INV-…) take the French ones (`NUMBERING`); a format
//    someone chose is left alone. Numbers already issued keep their text and the counters do not move.
// 2. Catering requests marked "Devis envoyé" (`quoted`) become "Client contacté" (`contacted`).
// Run: npm run migrate:2026-11 -- --check
import { getPayload } from 'payload';
import { NUMBERING } from '@/modules/settings/globals';

const OLD: Record<keyof typeof NUMBERING, string> = {
  invoice: 'INV-{YYYY}-{00000}',
  creditNote: 'CN-{YYYY}-{00000}',
  quotation: 'QUO-{YYYY}-{00000}',
  deliveryNote: 'DN-{YYYY}-{00000}',
  order: 'ORD-{YYYY}-{00000}',
  cateringRequest: 'REQ-{YYYY}-{0000}',
  reservation: 'RES-{YYYY}-{00000}',
};

const check = process.argv.includes('--check');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
const context = { skipRevalidate: true }; // no Next.js runtime here

const settings = await payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true });
const stored: Record<string, string | null | undefined> = { ...settings.numbering };
const numbering = { ...stored };
for (const key of Object.keys(NUMBERING) as (keyof typeof NUMBERING)[]) {
  const now = stored[key];
  if (now === NUMBERING[key] || (now && now !== OLD[key])) continue;
  numbering[key] = NUMBERING[key];
  console.info(`[numbering] ${key}: ${now ?? '(empty)'} → ${NUMBERING[key]}`);
}
const formats = Object.keys(numbering).filter((k) => numbering[k] !== stored[k]).length;
if (formats && !check) await payload.updateGlobal({ slug: 'BusinessSettings', data: { numbering }, depth: 0, overrideAccess: true, context });

const quoted = await payload.find({ collection: 'cateringRequests', where: { status: { equals: 'quoted' } }, limit: 0, depth: 0, overrideAccess: true });
for (const r of quoted.docs) console.info(`[catering] ${r.number}: Devis envoyé → Client contacté`);
if (quoted.docs.length && !check) {
  await payload.update({ collection: 'cateringRequests', where: { status: { equals: 'quoted' } }, data: { status: 'contacted' }, depth: 0, overrideAccess: true, context });
}

console.info(`[migrate] ${formats} format(s), ${quoted.docs.length} catering request(s)${check ? ' to change (check only)' : ' changed'}`);
await payload.destroy();
process.exit(0);
