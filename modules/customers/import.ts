import { randomBytes } from 'node:crypto';
import type { Payload } from 'payload';
import { headerKey, type Table } from '@/lib/table';
import { normalizeVat } from './vat';

// Business customers from a spreadsheet (DEP-08, M3.2 T1): `company, vat, contact, email, phone, address, group,
// price_list, payment_term`. Idempotent by e-mail: a known e-mail is updated, a new one created (with a random
// password: the customer chooses their own through "forgot password"). Groups are created by name; a price list must
// exist (import it first). Every row is checked first; with one bad row nothing is written. The contract caps the list
// at 30 customers (Q§12); the code does not.

export type CustomerRow = {
  line: number;
  company: string;
  vat: string;
  contact: string;
  email: string;
  phone: string;
  address: { line1: string; postalCode: string; city: string } | null;
  group: string;
  priceList: string;
  paymentTerm: string;
};

const TERMS = ['0', '8', '15', '30', '45', '60'];

/** "12 rue X, L-7795 Bissen" → street, postcode, town (the postcode's "L-" dropped). */
function addressOf(text: string) {
  const match = text.match(/^(.+?),\s*(?:L-)?(\d{4})\s+(.+)$/i);
  return match ? { line1: match[1].trim(), postalCode: match[2], city: match[3].trim() } : null;
}

export function parseCustomers(table: Table) {
  const col = (want: string) => table.headers.find((h) => headerKey(h) === headerKey(want));
  const get = (raw: Record<string, string>, want: string) => (col(want) ? (raw[col(want)!] ?? '').trim() : '');
  const rows: CustomerRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  table.rows.forEach((raw, i) => {
    const line = i + 2;
    if (table.overflow?.includes(line))
      return void errors.push({
        line,
        reason: 'more cells than columns: quote any value that contains a comma (an address, an amount)',
      });
    const email = get(raw, 'email').toLowerCase();
    const company = get(raw, 'company');
    if (!email && !company) return;
    const address = get(raw, 'address');
    const term = get(raw, 'payment_term').replace(/\D/g, '') || '0';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push({ line, reason: `e-mail "${email}" is not valid` });
    else if (!company) errors.push({ line, reason: 'company is required' });
    else if (!TERMS.includes(term))
      errors.push({ line, reason: `payment_term ${term} must be one of ${TERMS.join(', ')} (days)` });
    else if (address && !addressOf(address))
      errors.push({ line, reason: `address "${address}" must read "street, postcode town"` });
    else
      rows.push({
        line,
        company,
        vat: get(raw, 'vat'),
        contact: get(raw, 'contact') || company,
        email,
        phone: get(raw, 'phone'),
        address: address ? addressOf(address) : null,
        group: get(raw, 'group'),
        priceList: get(raw, 'price_list'),
        paymentTerm: term,
      });
  });
  return { rows, errors };
}

export async function importCustomers(payload: Payload, rows: CustomerRow[], { dryRun = false } = {}) {
  const errors: { line: number; reason: string }[] = [];
  const listNames = [...new Set(rows.map((r) => r.priceList).filter(Boolean))];
  const { docs: lists } = await payload.find({
    collection: 'priceLists',
    where: { name: { in: listNames } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });
  for (const r of rows)
    if (r.priceList && !lists.some((l) => l.name === r.priceList))
      errors.push({ line: r.line, reason: `price list "${r.priceList}" not found (import it first)` });
  if (errors.length > 0 || dryRun) return { errors, created: 0, updated: 0 };

  const groupId = new Map<string, string>();
  for (const name of new Set(rows.map((r) => r.group).filter(Boolean))) {
    const { docs } = await payload.find({
      collection: 'customerGroups',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    });
    groupId.set(
      name,
      docs[0]?.id ??
        (await payload.create({ collection: 'customerGroups', data: { name }, overrideAccess: true, depth: 0 })).id,
    );
  }
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const data = {
      name: r.contact,
      type: 'business' as const,
      company: r.company,
      vatNumber: r.vat ? normalizeVat(r.vat) : undefined,
      phone: r.phone || undefined,
      group: r.group ? groupId.get(r.group) : undefined,
      priceList: r.priceList ? lists.find((l) => l.name === r.priceList)?.id : undefined,
      paymentTerm: r.paymentTerm as '0',
      ...(r.address ? { addresses: [{ label: r.company, isDefault: true, ...r.address, country: 'LU' }] } : {}),
    };
    const { docs } = await payload.find({
      collection: 'customers',
      where: { email: { equals: r.email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    });
    if (docs[0]) {
      await payload.update({ collection: 'customers', id: docs[0].id, data, overrideAccess: true, depth: 0 });
      updated += 1;
    } else {
      await payload.create({
        collection: 'customers',
        data: {
          ...data,
          email: r.email,
          password: randomBytes(24).toString('base64url'),
          locale: 'fr',
          marketingConsent: false,
        },
        overrideAccess: true,
        depth: 0,
      });
      created += 1;
    }
  }
  return { errors, created, updated };
}
