import { createHash } from 'node:crypto';
import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import { NO_EMAIL_DOMAIN, sendMail } from '@/lib/mail';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { readTable } from '@/lib/table';
import { type Tx, withTx } from '@/lib/tx';
import { postMovements } from '@/modules/inventory/service';
import { priceDocument } from '@/modules/promotions/pricing';
import { vatRates } from '@/modules/promotions/service';
import { NUMBERING } from '@/modules/settings/globals';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { Order, Outbox, PosImport } from '@/payload-types';
import { connector, type PosConnector, type PosOrder } from './connector';
import { type CsvMapping, DEFAULT_MAPPING, parseSalesCsv, type RowError, type SaleRow } from './csv';

// The till (M3.3 T5, 02 §6). Outbox: events queued in the order's own transaction when the POS module is on, sent by
// the `outbox-process` job with backoff (1 min, 5 min, 30 min, 2 h, 12 h), given up after 5 attempts with an e-mail.
// Import: the till's daily sales file → preview (matched by barcode, a box's barcode, then SKU; unmatched listed and
// fixable) → confirm: one `pos` order per receipt and its `pos_import` movements, in one transaction. A file is known
// by its hash: once imported, the same file is refused.

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as { id: string }).id) : String(v));

// ---- Outbox ----------------------------------------------------------------------------------------------------------

const posOrderOf = (order: Order): PosOrder => ({
  id: order.id,
  number: order.number ?? '',
  channel: order.channel ?? '',
  status: order.status ?? '',
  totalCents: order.totals?.totalCents ?? 0,
  lines: (order.lines ?? []).map((l) => ({ variant: idOf(l.variant), unitQty: l.unitQty, baseQty: l.baseQty, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents })),
});

/**
 * Queues an order event for the till inside the caller's transaction (it rolls back with the order). Only with the POS
 * module on, and never for a sale that came from the till itself.
 */
export async function enqueue(tx: Tx, topic: 'order.created' | 'order.confirmed' | 'order.cancelled' | 'order.refunded', order: Order) {
  if (order.channel === 'pos') return;
  const { modules } = await getSettingsPrivate();
  if (modules?.pos !== true) return;
  await tx.req.payload.create({
    collection: 'outbox',
    data: { topic, ref: order.number, payload: posOrderOf(order), target: connector().name, status: 'pending', attempts: 0, nextAttemptAt: new Date().toISOString() },
    overrideAccess: true,
    depth: 0,
    req: tx.req,
  });
}

/** Minutes to wait after the 1st, 2nd… failed attempt. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = 5;
/** A row left `sending` by a crash is taken again after this long. */
const STALE_MS = 10 * 60_000;

async function alertDead(payload: Payload, row: Outbox) {
  const settings = await getSettingsPrivate();
  const to = settings.alerts?.outboxAlertEmail;
  if (!to) return;
  const text = `La caisse n’a pas reçu « ${row.topic} » ${row.ref ? `(${row.ref}) ` : ''}après ${MAX_ATTEMPTS} essais. Dernière erreur : ${row.lastError ?? '—'}.\nAdmin › Envois vers la caisse : ouvrez l’envoi et « Relancer ».`;
  await sendMail({ to, subject: `Caisse : envoi abandonné (${row.ref ?? row.topic})`, text, html: `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` });
}

/**
 * The `outbox-process` job: claims due rows one at a time (pending, failed and due, or stuck sending), sends each
 * through the adapter, logs the call, and records the result. Returns how many were sent, failed and given up.
 */
export async function processOutbox(payload: Payload, { now = new Date(), adapter = connector(), limit = 50 }: { now?: Date; adapter?: PosConnector; limit?: number } = {}) {
  const rows = payload.db.collections.outbox;
  const done = { sent: 0, failed: 0, dead: 0 };
  for (let i = 0; i < limit; i++) {
    const claimed = await rows.collection.findOneAndUpdate(
      {
        $or: [
          { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: now } },
          { status: 'sending', updatedAt: { $lt: new Date(now.getTime() - STALE_MS) } },
        ],
      },
      { $set: { status: 'sending', updatedAt: now } },
      { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
    );
    if (!claimed) break;
    const row = { ...(claimed as unknown as Outbox), id: String(claimed._id) };
    const started = Date.now();
    let result: Awaited<ReturnType<PosConnector['pushOrder']>>;
    try {
      result = await adapter.pushOrder(row.topic, row.payload as PosOrder);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    const ms = Date.now() - started;
    await payload.create({
      collection: 'integrationLogs',
      data: { target: adapter.name, direction: 'out', outbox: row.id, request: { topic: row.topic, payload: row.payload }, response: (result.response ?? (result.ok ? { note: result.note ?? null } : { error: result.error })) as never, ok: result.ok, ms, expiresAt: new Date(now.getTime() + 90 * 86_400_000).toISOString() },
      overrideAccess: true,
      depth: 0,
    });
    const attempts = (row.attempts ?? 0) + 1;
    if (result.ok) {
      await rows.updateOne({ _id: claimed._id }, { $set: { status: 'sent', sentAt: now, attempts, note: result.note ?? null, lastError: null } });
      done.sent++;
    } else if (attempts >= MAX_ATTEMPTS) {
      await rows.updateOne({ _id: claimed._id }, { $set: { status: 'dead', attempts, lastError: result.error } });
      await alertDead(payload, { ...row, attempts, lastError: result.error });
      done.dead++;
    } else {
      const next = new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1] * 60_000);
      await rows.updateOne({ _id: claimed._id }, { $set: { status: 'failed', attempts, nextAttemptAt: next, lastError: result.error } });
      done.failed++;
    }
  }
  return done;
}

/** "Retry now" on a failed or given-up row: due at once; a given-up row gets a fresh set of attempts. */
export async function retryOutbox(payload: Payload, id: string, now = new Date()) {
  const res = await payload.db.collections.outbox.updateOne(
    { _id: id, status: { $in: ['failed', 'dead'] } },
    [{ $set: { nextAttemptAt: now, attempts: { $cond: [{ $eq: ['$status', 'dead'] }, 0, '$attempts'] }, status: 'pending' } }],
  );
  if (res.matchedCount === 0) throw new AppError('CONFLICT', 'notRetryable');
}

// ---- Sales file import -----------------------------------------------------------------------------------------------

export type Match = { variant: string; unit: string | null; factor: number; name: string; vatBp: number };
type Stored = SaleRow & { match?: Match | null };

const mappingOf = (m: Partial<Record<keyof CsvMapping, string | null>> | null | undefined): CsvMapping => ({ ...DEFAULT_MAPPING, ...Object.fromEntries(Object.entries(m ?? {}).filter(([, v]) => typeof v === 'string')) }) as CsvMapping;

/** Finds the size each code names: a size's barcode, a box's barcode (its factor), else a size's SKU. */
async function matchCodes(payload: Payload, codes: string[]) {
  const found = new Map<string, Omit<Match, 'vatBp' | 'name'> & { product: string }>();
  if (codes.length === 0) return { found, names: new Map<string, string>(), vat: new Map<string, string>() };
  const [byBarcode, units, bySku] = await Promise.all([
    payload.find({ collection: 'variants', where: { barcode: { in: codes } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { barcode: true, product: true } }),
    payload.find({ collection: 'packagingUnits', where: { barcode: { in: codes } }, limit: 0, pagination: false, depth: 1, overrideAccess: true, select: { barcode: true, factor: true, variant: true } }),
    payload.find({ collection: 'variants', where: { sku: { in: codes } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { sku: true, product: true } }),
  ]);
  for (const v of bySku.docs) if (v.sku) found.set(v.sku, { variant: v.id, unit: null, factor: 1, product: idOf(v.product) });
  for (const u of units.docs) if (u.barcode && typeof u.variant === 'object') found.set(u.barcode, { variant: u.variant.id, unit: u.id, factor: u.factor, product: idOf(u.variant.product) });
  for (const v of byBarcode.docs) if (v.barcode) found.set(v.barcode, { variant: v.id, unit: null, factor: 1, product: idOf(v.product) });
  const productIds = [...new Set([...found.values()].map((f) => f.product))];
  const products = productIds.length ? (await payload.find({ collection: 'products', where: { id: { in: productIds } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { name: true, vatClass: true } })).docs : [];
  return { found, names: new Map(products.map((p) => [p.id, p.name ?? ''])), vat: new Map(products.map((p) => [p.id, p.vatClass ?? 'standard'])) };
}

/** Matches every row (the code a manager assigned to a code first), with the size's name and VAT rate. */
async function matchRows(payload: Payload, rows: SaleRow[], assignments: Record<string, string>) {
  const codeOf = (r: SaleRow) => r.barcode ?? r.ref ?? '';
  const asked = [...new Set(rows.flatMap((r) => [r.barcode, r.ref, assignments[codeOf(r)]].filter(Boolean) as string[]))];
  const [{ found, names, vat }, rates] = await Promise.all([matchCodes(payload, asked), vatRates()]);
  return rows.map((r): Stored => {
    const hit = found.get(assignments[codeOf(r)] ?? '') ?? (r.barcode ? found.get(r.barcode) : undefined) ?? (r.ref ? found.get(r.ref) : undefined);
    if (!hit) return { ...r, match: null };
    const { product, ...m } = hit;
    return { ...r, match: { ...m, name: names.get(product) ?? '', vatBp: rates[vat.get(product) as keyof typeof rates] ?? rates.standard } };
  });
}

export type ImportPreview = {
  id: string;
  filename: string;
  status: NonNullable<PosImport['status']>;
  receipts: number;
  lines: number;
  totalCents: number;
  days: string[];
  /** Matched and not yet imported, by receipt. */
  ready: { receipt: string; date: string; time: string; lines: { name: string; qty: number; unitPriceCents: number; factor: number }[]; totalCents: number }[];
  unmatched: { code: string; lines: number[]; qty: number }[];
  errors: RowError[];
  posted: number;
};

function previewOf(doc: PosImport): ImportPreview {
  const rows = (doc.rows ?? []) as Stored[];
  const posted = new Set((doc.postedLines ?? []) as number[]);
  const open = rows.filter((r) => !posted.has(r.line));
  const ready = new Map<string, ImportPreview['ready'][number]>();
  for (const r of open.filter((r) => r.match)) {
    const g = ready.get(r.receipt) ?? { receipt: r.receipt, date: r.date, time: r.time, lines: [], totalCents: 0 };
    g.lines.push({ name: r.match!.name, qty: r.qty, unitPriceCents: r.unitPriceCents, factor: r.match!.factor });
    g.totalCents += r.qty * r.unitPriceCents;
    ready.set(r.receipt, g);
  }
  const unmatched = new Map<string, ImportPreview['unmatched'][number]>();
  for (const r of open.filter((r) => !r.match)) {
    const code = r.barcode ?? r.ref ?? '';
    const u = unmatched.get(code) ?? { code, lines: [], qty: 0 };
    u.lines.push(r.line);
    u.qty += r.qty;
    unmatched.set(code, u);
  }
  return {
    id: doc.id,
    filename: doc.filename,
    status: doc.status ?? 'preview',
    receipts: new Set(rows.map((r) => r.receipt)).size,
    lines: rows.length,
    totalCents: rows.reduce((s, r) => s + r.qty * r.unitPriceCents, 0),
    days: [...new Set(rows.map((r) => r.date))].sort(),
    ready: [...ready.values()],
    unmatched: [...unmatched.values()],
    errors: (doc.rowErrors ?? []) as RowError[],
    posted: posted.size,
  };
}

/**
 * Reads a sales file and shows what it would import. The same file again: its import in progress is reopened; once
 * (partly) imported it is refused (AC-M3.3-07).
 */
export async function previewImport(payload: Payload, { data, filename, user }: { data: Buffer; filename: string; user: string }) {
  const hash = createHash('sha256').update(data).digest('hex');
  const { docs } = await payload.find({ collection: 'posImports', where: { hash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true });
  if (docs[0] && docs[0].status !== 'preview') throw new AppError('CONFLICT', 'alreadyImported');
  if (docs[0]) return previewOf(docs[0]);
  const settings = await getSettingsPrivate();
  const { rows, errors, missing } = parseSalesCsv(await readTable(data, filename), mappingOf(settings.pos?.csvMapping));
  if (missing.length) throw new AppError('VALIDATION', `columns:${missing.join(', ')}`, 'file');
  if (rows.length === 0) throw new AppError('VALIDATION', 'noRows', 'file');
  const stored = await matchRows(payload, rows, {});
  const doc = await payload.create({
    collection: 'posImports',
    data: { filename, hash, status: 'preview', rows: stored as never, rowErrors: errors as never, assignments: {}, postedLines: [], unmatched: stored.filter((r) => !r.match).length, user },
    overrideAccess: true,
    depth: 0,
  });
  return previewOf(doc);
}

export async function importPreview(payload: Payload, id: string) {
  const doc = await payload.findByID({ collection: 'posImports', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!doc) throw new AppError('NOT_FOUND', 'import');
  return previewOf(doc);
}

/** An unmatched code fixed: "this code is the size with that barcode or SKU". Every row with that code is matched again. */
export async function assignCode(payload: Payload, { id, code, target }: { id: string; code: string; target: string }) {
  const doc = await payload.findByID({ collection: 'posImports', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!doc || doc.status === 'posted') throw new AppError('NOT_FOUND', 'import');
  const { found } = await matchCodes(payload, [target.trim()]);
  if (!found.has(target.trim())) throw new AppError('VALIDATION', 'unknownCode', 'target');
  const assignments = { ...((doc.assignments ?? {}) as Record<string, string>), [code]: target.trim() };
  const rows = await matchRows(payload, doc.rows as SaleRow[], assignments);
  const posted = new Set((doc.postedLines ?? []) as number[]);
  const updated = await payload.update({
    collection: 'posImports',
    id,
    data: { rows: rows as never, assignments, unmatched: rows.filter((r) => !r.match && !posted.has(r.line)).length },
    overrideAccess: true,
    depth: 0,
  });
  return previewOf(updated);
}

/**
 * Imports the matched rows not imported yet, in one transaction: one completed, paid `pos` order per receipt (its own
 * POS-YYYY-NNNNN number, the receipt's day and time as its sale day) and `pos_import` movements, which never block on
 * stock (a negative stock shows as low). Unmatched rows wait for a fix and a later confirm.
 */
export async function confirmImport(payload: Payload, { id, user }: { id: string; user: string }) {
  const settings = await getSettingsPrivate();
  return withTx(payload, async (tx) => {
    const doc = await tx.req.payload.findByID({ collection: 'posImports', id, depth: 0, overrideAccess: true, disableErrors: true, req: tx.req });
    if (!doc || doc.status === 'posted') throw new AppError('CONFLICT', 'alreadyImported');
    const round = (doc.confirms ?? 0) + 1;
    // The claim: two confirms at once → the second finds the round taken.
    const claim = await tx.model('posImports').updateOne({ _id: doc.id, confirms: doc.confirms ?? 0 }, { $set: { confirms: round } }, { session: tx.session });
    if (claim.matchedCount === 0) throw new AppError('CONFLICT', 'alreadyImported');
    const rows = (doc.rows ?? []) as Stored[];
    const posted = new Set((doc.postedLines ?? []) as number[]);
    const todo = rows.filter((r) => r.match && !posted.has(r.line));
    if (todo.length === 0) throw new AppError('VALIDATION', 'nothingToImport');
    const receipts = new Map<string, Stored[]>();
    for (const r of todo) receipts.set(r.receipt, [...(receipts.get(r.receipt) ?? []), r]);
    const numbers: string[] = [];
    for (const [receipt, lines] of receipts) {
      const { date, time } = lines[0];
      const year = Number(date.slice(0, 4));
      const number = formatNumber(settings.numbering?.pos ?? NUMBERING.pos, year, await nextNumber(tx, 'pos', year));
      const priced = priceDocument(lines.map((l) => ({ qty: l.qty, unitPriceCents: l.unitPriceCents, vatBp: l.match!.vatBp })));
      const at = new Date().toISOString();
      const order = await tx.req.payload.create({
        collection: 'orders',
        req: tx.req,
        overrideAccess: true,
        depth: 0,
        data: {
          number,
          idempotencyKey: `pos:${doc.hash}:${receipt}:${round}`,
          status: 'completed',
          channel: 'pos',
          mode: 'instore',
          contact: { name: `Caisse · ticket ${receipt}`, email: `caisse@${NO_EMAIL_DOMAIN}`, phone: '' },
          slot: { date, from: time, to: time },
          slotAt: `${date}T${time}`,
          lines: lines.map((l, i) => ({
            variant: l.match!.variant,
            unit: l.match!.unit ?? undefined,
            unitQty: l.qty,
            baseQty: l.qty * l.match!.factor,
            name: l.match!.name,
            unitPriceCents: l.unitPriceCents,
            vatBp: l.match!.vatBp,
            totalCents: priced.lines[i].totalCents,
          })),
          totals: { subtotalCents: priced.subtotalCents, discountCents: 0, deliveryCents: 0, vatCents: priced.vatCents, totalCents: priced.totalCents, vatBreakdown: priced.vatBreakdown },
          payment: { provider: 'manual', method: 'onsite', status: 'paid', paidCents: priced.totalCents },
          locale: 'fr',
          notes: `${doc.filename} · ticket ${receipt}`,
          stockPosted: true,
          history: [{ at, from: 'pending', to: 'completed', user, reason: doc.filename }],
        },
      });
      await postMovements(
        tx,
        lines.map((l) => ({ variant: l.match!.variant, unit: l.match!.unit ?? undefined, unitQty: -l.qty, type: 'pos_import' as const, channel: 'pos' as const, ref: { relationTo: 'orders' as const, value: order.id }, user })),
      );
      numbers.push(number);
    }
    const nowPosted = [...posted, ...todo.map((r) => r.line)];
    const left = rows.filter((r) => !nowPosted.includes(r.line)).length;
    await tx.req.payload.update({
      collection: 'posImports',
      id: doc.id,
      data: { postedLines: nowPosted, status: left ? 'partial' : 'posted', receipts: (doc.receipts ?? 0) + receipts.size, matched: nowPosted.length, unmatched: left },
      overrideAccess: true,
      depth: 0,
      req: tx.req,
    });
    return { orders: numbers, lines: todo.length, left };
  });
}
