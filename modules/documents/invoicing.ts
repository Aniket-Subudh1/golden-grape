import { createHash } from 'node:crypto';
import type { Payload } from 'payload';
import { AppError } from '@/lib/errors';
import { getDictionary, type Locale } from '@/lib/i18n';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { addDays, fromLocal, today } from '@/lib/time';
import { type Tx, withTx } from '@/lib/tx';
import { priceDocument } from '@/modules/promotions/pricing';
import { NUMBERING } from '@/modules/settings/globals';
import { transferAccount } from '@/modules/settings/iban';
import type { CreditNote, Customer, DeliveryNote, Invoice, Order } from '@/payload-types';
import { type BusinessDoc, type BusinessDocKind, renderBusinessPdf } from './pdf/business';

// Invoices, delivery notes and credit notes (M3.2 T5, R5). Each is numbered with `nextNumber` in the same transaction
// that writes it and its PDF: a failed render rolls the number back (no gap), two issues at once get two numbers (no
// duplicate). Issued documents never change (collections.ts, `frozen`); a correction is a credit note.

export type Render = typeof renderBusinessPdf;
const idOf = (v: unknown) =>
  typeof v === 'object' && v !== null ? String((v as { id: string }).id) : v ? String(v) : null;
/** Statuses of an order that was sold (it can be invoiced): confirmed or further, not cancelled. */
const SOLD = ['confirmed', 'ready', 'out_for_delivery', 'completed'];

async function settingsOf(tx: Tx) {
  const s = await tx.req.payload.findGlobal({ slug: 'BusinessSettings', depth: 0, overrideAccess: true, req: tx.req });
  return s as typeof s & { invoiceLegal?: string | null; invoicePaymentNote?: string | null };
}

/** Text of a localized settings field in the document's language (the global is read in the default locale). */
async function localized(tx: Tx, field: 'invoiceLegal' | 'invoicePaymentNote', locale: Locale) {
  const s = (await tx.req.payload.findGlobal({
    slug: 'BusinessSettings',
    depth: 0,
    overrideAccess: true,
    req: tx.req,
    locale,
    fallbackLocale: 'fr',
  })) as unknown as Record<string, unknown>;
  return (s[field] as string | null | undefined) ?? null;
}

async function pdfFor(tx: Tx, doc: BusinessDoc, locale: Locale, render: Render) {
  const settings = await settingsOf(tx);
  const [{ documents }, legal, paymentNote] = await Promise.all([
    getDictionary(locale),
    localized(tx, 'invoiceLegal', locale),
    localized(tx, 'invoicePaymentNote', locale),
  ]);
  const account = transferAccount(settings.business?.bankAccounts);
  return render({
    doc: { ...doc, legal, paymentNote, account },
    t: documents,
    locale,
    business: settings.business ?? {},
  });
}

async function storePdf(
  tx: Tx,
  kind: 'invoice' | 'credit_note' | 'delivery_note',
  filename: string,
  buffer: Buffer,
  order: string | null,
  customer: string | null,
) {
  return tx.req.payload.create({
    collection: 'documentFiles',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: {
      kind,
      filename,
      order: order ?? undefined,
      customer: customer ?? undefined,
      sizeBytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      data: buffer.toString('base64'),
    },
  });
}

async function nextOf(tx: Tx, series: 'invoice' | 'creditNote' | 'deliveryNote', now: Date) {
  const year = Number(today(now).slice(0, 4));
  const n = await nextNumber(tx, series, year);
  const s = await settingsOf(tx);
  const format = (s.numbering as Record<string, string | null | undefined> | undefined)?.[series] ?? NUMBERING[series];
  return formatNumber(format, year, n);
}

/** The customer's billing details at the moment of issue (they never change on the document afterwards). */
function billingOf(order: Order, customer: Customer | null) {
  const a = order.address ?? customer?.addresses?.find((x) => x.isDefault) ?? customer?.addresses?.[0] ?? null;
  return {
    name: order.contact?.name ?? customer?.name ?? '',
    company: customer?.type === 'business' ? (customer.company ?? null) : null,
    vatNumber: customer?.type === 'business' ? (customer.vatNumber ?? null) : null,
    email: order.contact?.email && !order.contact.email.endsWith('.invalid') ? order.contact.email : null,
    phone: order.contact?.phone ?? null,
    address: a ? [a.line1, a.line2, `L-${a.postalCode} ${a.city}`].filter(Boolean).join(', ') : null,
  };
}

const titleOf = (number: string, b: { company?: string | null; name?: string | null }) =>
  `${number} · ${b.company || b.name || ''}`.trim();

/** An order's lines as charged: unit price, the line's discounts (promotion + code), VAT, what was charged. */
function chargedLines(order: Order) {
  return (order.lines ?? []).map((l) => ({
    name: l.name,
    detail: l.detail ?? null,
    qty: l.unitQty,
    unitPriceCents: l.unitPriceCents,
    discountCents: (l.promoCents ?? 0) + (l.discountCents ?? 0),
    vatBp: l.vatBp,
    totalCents: l.totalCents - (l.discountCents ?? 0),
    variant: idOf(l.variant) ?? undefined,
    unit: idOf(l.unit) ?? undefined,
  }));
}

async function loadOrder(tx: Tx, id: string) {
  const order = await tx.req.payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req: tx.req,
  });
  if (!order) throw new AppError('NOT_FOUND', 'order');
  const customer = order.customer
    ? await tx.req.payload.findByID({
        collection: 'customers',
        id: idOf(order.customer)!,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req: tx.req,
      })
    : null;
  return { order, customer };
}

// ---- Invoices ------------------------------------------------------------------------------------------------------

/** The invoice of an order, or null. */
export async function invoiceOf(payload: Payload, order: string, tx?: Tx) {
  const { docs } = await payload.find({
    collection: 'invoices',
    where: { order: { equals: order } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    ...(tx ? { req: tx.req } : {}),
  });
  return docs[0] ?? null;
}

/**
 * Issues the invoice of a sold order (once: a second call returns the first). Number, document and PDF in one
 * transaction; the due date is the issue day plus the customer's payment term. What was already settled (points,
 * gift cards, payments received) is shown and taken off what is due.
 */
export async function issueInvoice(
  payload: Payload,
  orderId: string,
  { now = new Date(), render = renderBusinessPdf }: { now?: Date; render?: Render } = {},
): Promise<Invoice> {
  return withTx(payload, async (tx) => {
    const existing = await invoiceOf(payload, orderId, tx);
    if (existing) return existing;
    const { order, customer } = await loadOrder(tx, orderId);
    if (!SOLD.includes(order.status ?? '')) throw new AppError('CONFLICT', 'notInvoiceable', 'status');
    const locale = (order.locale ?? customer?.locale ?? 'fr') as Locale;
    const number = await nextOf(tx, 'invoice', now);
    const day = today(now);
    const dueDay = addDays(day, Number(customer?.paymentTerm ?? 0));
    const totals = order.totals!;
    const money =
      (order.pricing?.loyaltyCents ?? 0) +
      (order.pricing?.giftCards ?? []).reduce((s, g) => s + (g.amountCents ?? 0), 0);
    const paidBeforeCents = money + (order.payment?.paidCents ?? 0);
    const amountDueCents = Math.max(0, (totals.totalCents ?? 0) - paidBeforeCents);
    const billing = billingOf(order, customer);
    const lines = chargedLines(order);
    const issuedAt = now.toISOString();
    const dueAt = fromLocal(...(dueDay.split('-').map(Number) as [number, number, number]), 12).toISOString();
    const pdf = await pdfFor(
      tx,
      {
        kind: 'invoice',
        number,
        issuedAt,
        dueAt,
        orderNumber: order.number,
        billing,
        lines,
        totals,
        paidBeforeCents,
        amountDueCents,
      },
      locale,
      render,
    );
    const file = await storePdf(tx, 'invoice', `${number}.pdf`, pdf, order.id, idOf(order.customer));
    return tx.req.payload.create({
      collection: 'invoices',
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: {
        number,
        title: titleOf(number, billing),
        status: amountDueCents === 0 ? 'paid' : 'issued',
        order: order.id,
        customer: idOf(order.customer) ?? undefined,
        billing,
        lines,
        totals: {
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          deliveryCents: totals.deliveryCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
          vatBreakdown: totals.vatBreakdown,
        },
        paidBeforeCents,
        amountDueCents,
        issuedAt,
        dueAt,
        ...(amountDueCents === 0 ? { paidAt: issuedAt } : {}),
        locale,
        pdf: file.id,
      },
    });
  });
}

/**
 * "Paid" on an invoice: the money still due goes on the order as a payment (one record of money), then the invoice
 * says paid. Already paid → nothing changes.
 */
export async function markInvoicePaid(
  payload: Payload,
  invoiceId: string,
  { at = new Date(), method = 'transfer', user }: { at?: Date; method?: string; user?: string } = {},
) {
  const invoice = await payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  });
  if (!invoice) throw new AppError('NOT_FOUND', 'invoice');
  if (invoice.status !== 'issued') return invoice;
  const order = await payload.findByID({
    collection: 'orders',
    id: idOf(invoice.order)!,
    depth: 0,
    overrideAccess: true,
  });
  const due = Math.max(
    0,
    (order.pricing?.amountDueCents ?? order.totals?.totalCents ?? 0) - (order.payment?.paidCents ?? 0),
  );
  if (due > 0) {
    const { recordPayment } = await import('@/modules/sales/service');
    await recordPayment(payload, order.id, { amountCents: due, at, method, reference: invoice.number, user });
  }
  return withTx(payload, (tx) =>
    tx.req.payload.update({
      collection: 'invoices',
      id: invoice.id,
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: { status: 'paid', paidAt: at.toISOString() },
    }),
  );
}

// ---- Credit notes --------------------------------------------------------------------------------------------------

/**
 * A credit note on an invoice, inside the caller's transaction: by default everything still creditable; or chosen
 * lines and quantities. Never more than the invoice still holds; the invoice becomes credited or partly credited.
 */
export async function creditInTx(
  tx: Tx,
  invoiceId: string,
  {
    reason,
    lines: chosen,
    now = new Date(),
    render = renderBusinessPdf,
  }: { reason: string; lines?: { index: number; qty: number }[]; now?: Date; render?: Render },
): Promise<CreditNote> {
  const invoice = await tx.req.payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req: tx.req,
  });
  if (!invoice) throw new AppError('NOT_FOUND', 'invoice');
  const total = invoice.totals?.totalCents ?? 0;
  const left = total - (invoice.creditedCents ?? 0);
  if (left <= 0) throw new AppError('CONFLICT', 'alreadyCredited', 'invoice');
  const source = invoice.lines ?? [];
  const picked = chosen?.length
    ? chosen.map(({ index, qty }) => {
        const line = source[index];
        if (!line || qty <= 0 || qty > line.qty) throw new AppError('VALIDATION', 'creditQty', 'lines');
        return {
          ...line,
          qty,
          totalCents: Math.round(((line.totalCents ?? 0) * qty) / line.qty),
          discountCents: Math.round(((line.discountCents ?? 0) * qty) / line.qty),
        };
      })
    : (invoice.creditedCents ?? 0) === 0
      ? source.map((l) => ({ ...l }))
      : null;
  // A part already credited and no lines chosen: credit what is left as one line per VAT rate, in proportion.
  const lines =
    picked ??
    (invoice.totals?.vatBreakdown ?? []).map((v) => ({
      name: reason,
      detail: null,
      qty: 1,
      unitPriceCents: null,
      discountCents: 0,
      vatBp: v.rateBp,
      totalCents: Math.round((((v.baseCents ?? 0) + (v.vatCents ?? 0)) * left) / total),
    }));
  const delivery = !chosen?.length && (invoice.creditedCents ?? 0) === 0 ? (invoice.totals?.deliveryCents ?? 0) : 0;
  const priced = priceDocument([
    ...lines.map((l) => ({ qty: 1, unitPriceCents: l.totalCents ?? 0, vatBp: l.vatBp ?? 0 })),
    ...(delivery
      ? [{ qty: 1, unitPriceCents: delivery, vatBp: invoice.totals?.vatBreakdown?.[0]?.rateBp ?? 1700 }]
      : []),
  ]);
  if (priced.totalCents > left) throw new AppError('VALIDATION', 'creditTooHigh', 'lines');
  const locale = (invoice.locale ?? 'fr') as Locale;
  const number = await nextOf(tx, 'creditNote', now);
  const issuedAt = now.toISOString();
  const totals = {
    subtotalCents: priced.subtotalCents,
    discountCents: 0,
    deliveryCents: delivery,
    vatCents: priced.vatCents,
    totalCents: priced.totalCents,
    vatBreakdown: priced.vatBreakdown,
  };
  const billing = invoice.billing ?? {};
  const docLines = lines.map((l) => ({
    name: l.name,
    detail: l.detail ?? null,
    qty: l.qty,
    unitPriceCents: l.unitPriceCents ?? null,
    discountCents: l.discountCents ?? 0,
    vatBp: l.vatBp ?? 0,
    totalCents: l.totalCents ?? 0,
  }));
  const pdf = await pdfFor(
    tx,
    { kind: 'creditNote', number, issuedAt, invoiceNumber: invoice.number, reason, billing, lines: docLines, totals },
    locale,
    render,
  );
  const file = await storePdf(tx, 'credit_note', `${number}.pdf`, pdf, idOf(invoice.order), idOf(invoice.customer));
  const credited = (invoice.creditedCents ?? 0) + priced.totalCents;
  await tx.req.payload.update({
    collection: 'invoices',
    id: invoice.id,
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: { creditedCents: credited, status: credited >= total ? 'credited' : 'partly_credited' },
  });
  return tx.req.payload.create({
    collection: 'creditNotes',
    req: tx.req,
    overrideAccess: true,
    depth: 0,
    data: {
      number,
      title: titleOf(number, billing),
      invoice: invoice.id,
      order: idOf(invoice.order) ?? undefined,
      customer: idOf(invoice.customer) ?? undefined,
      reason,
      billing,
      lines: docLines,
      totals,
      issuedAt,
      locale,
      pdf: file.id,
    },
  });
}

export const issueCreditNote = (payload: Payload, invoiceId: string, input: Parameters<typeof creditInTx>[2]) =>
  withTx(payload, (tx) => creditInTx(tx, invoiceId, input));

/** A refunded order (applyTransition) that has an invoice gets its credit note in the same transaction. */
export async function creditRefundedOrder(tx: Tx, order: Order, reason?: string) {
  const invoice = await invoiceOf(tx.req.payload, order.id, tx);
  if (!invoice || (invoice.creditedCents ?? 0) >= (invoice.totals?.totalCents ?? 0)) return null;
  return creditInTx(tx, invoice.id, { reason: reason ?? order.payment?.refundReason ?? 'refund' });
}

// ---- Delivery notes ------------------------------------------------------------------------------------------------

/** The delivery note of a sold order (once), without prices. */
export async function issueDeliveryNote(
  payload: Payload,
  orderId: string,
  { now = new Date(), render = renderBusinessPdf }: { now?: Date; render?: Render } = {},
): Promise<DeliveryNote> {
  return withTx(payload, async (tx) => {
    const { docs } = await payload.find({
      collection: 'deliveryNotes',
      where: { order: { equals: orderId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
      req: tx.req,
    });
    if (docs[0]) return docs[0];
    const { order, customer } = await loadOrder(tx, orderId);
    if (!SOLD.includes(order.status ?? '')) throw new AppError('CONFLICT', 'notInvoiceable', 'status');
    const locale = (order.locale ?? customer?.locale ?? 'fr') as Locale;
    const number = await nextOf(tx, 'deliveryNote', now);
    const billing = billingOf(order, customer);
    const lines = (order.lines ?? []).map((l) => ({
      name: l.name,
      detail: l.detail ?? null,
      qty: l.unitQty,
      variant: idOf(l.variant) ?? undefined,
      unit: idOf(l.unit) ?? undefined,
    }));
    const issuedAt = now.toISOString();
    const pdf = await pdfFor(
      tx,
      { kind: 'deliveryNote', number, issuedAt, orderNumber: order.number, billing, lines },
      locale,
      render,
    );
    const file = await storePdf(tx, 'delivery_note', `${number}.pdf`, pdf, order.id, idOf(order.customer));
    return tx.req.payload.create({
      collection: 'deliveryNotes',
      req: tx.req,
      overrideAccess: true,
      depth: 0,
      data: {
        number,
        title: titleOf(number, billing),
        order: order.id,
        customer: idOf(order.customer) ?? undefined,
        billing,
        lines,
        issuedAt,
        locale,
        pdf: file.id,
      },
    });
  });
}

// ---- The accountant's export ---------------------------------------------------------------------------------------

/** Invoices and credit notes issued between two Luxembourg days, one row each: amounts net and VAT per rate (credit notes negative). */
export async function exportDocuments(payload: Payload, from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const where = {
    issuedAt: {
      greater_than_equal: fromLocal(fy, fm, fd).toISOString(),
      less_than: fromLocal(ty, tm, td + 1).toISOString(),
    },
  };
  const [inv, cn] = await Promise.all([
    payload.find({
      collection: 'invoices',
      where,
      sort: 'issuedAt',
      limit: 0,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    }),
    payload.find({
      collection: 'creditNotes',
      where,
      sort: 'issuedAt',
      limit: 0,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    }),
  ]);
  const docs: { kind: BusinessDocKind; d: Invoice | CreditNote; sign: number }[] = [
    ...inv.docs.map((d) => ({ kind: 'invoice' as const, d, sign: 1 })),
    ...cn.docs.map((d) => ({ kind: 'creditNote' as const, d, sign: -1 })),
  ].sort((a, b) => a.d.issuedAt.localeCompare(b.d.issuedAt));
  const rates = [...new Set(docs.flatMap(({ d }) => (d.totals?.vatBreakdown ?? []).map((v) => v.rateBp ?? 0)))].sort(
    (a, b) => b - a,
  );
  const euros = (cents: number) => (cents / 100).toFixed(2);
  const headers = [
    'type',
    'number',
    'date',
    'customer',
    'vat_number',
    ...rates.flatMap((r) => [`net_${r / 100}`, `vat_${r / 100}`]),
    'total',
    'status',
  ];
  const rows = docs.map(({ kind, d, sign }) => {
    const by = new Map((d.totals?.vatBreakdown ?? []).map((v) => [v.rateBp ?? 0, v]));
    return [
      kind === 'invoice' ? 'invoice' : 'credit_note',
      d.number,
      today(new Date(d.issuedAt)),
      d.billing?.company || d.billing?.name || '',
      d.billing?.vatNumber ?? '',
      ...rates.flatMap((r) => [euros(sign * (by.get(r)?.baseCents ?? 0)), euros(sign * (by.get(r)?.vatCents ?? 0))]),
      euros(sign * (d.totals?.totalCents ?? 0)),
      kind === 'invoice' ? ((d as Invoice).status ?? '') : '',
    ];
  });
  return { headers, rows };
}
