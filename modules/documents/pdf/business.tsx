import { existsSync } from 'node:fs';
import path from 'node:path';
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { PdfBusiness } from './quotation';

// Invoices, credit notes and delivery notes (M3.2 T5) as A4 PDFs, in the document's language: one layout for the
// three (logo and business details, the customer's billing snapshot, number and dates, the lines, VAT per rate,
// totals, payment and legal mentions). A delivery note has no prices. Until the accountant's mentions are entered,
// every page says "DRAFT – pending accountant" (A-07).

export type BusinessDocKind = 'invoice' | 'creditNote' | 'deliveryNote';
export type DocLine = {
  name: string;
  detail?: string | null;
  qty: number;
  unitPriceCents?: number | null;
  discountCents?: number | null;
  vatBp?: number | null;
  totalCents?: number | null;
};
export type DocTotals = {
  subtotalCents?: number | null;
  discountCents?: number | null;
  deliveryCents?: number | null;
  vatCents?: number | null;
  totalCents?: number | null;
  vatBreakdown?: { rateBp?: number | null; baseCents?: number | null; vatCents?: number | null }[] | null;
};
export type BusinessDoc = {
  kind: BusinessDocKind;
  number: string;
  issuedAt: string;
  dueAt?: string | null;
  orderNumber?: string | null;
  invoiceNumber?: string | null;
  reason?: string | null;
  billing: {
    name?: string | null;
    company?: string | null;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lines: DocLine[];
  totals?: DocTotals | null;
  paidBeforeCents?: number | null;
  amountDueCents?: number | null;
  paymentNote?: string | null;
  account?: { holder?: string | null; iban?: string | null; bic?: string | null; bankName?: string | null } | null;
  legal?: string | null;
};

const GOLD = '#8f6a24';
const INK = '#1c1a17';
const MUTED = '#6b6559';
const LINE = '#e3dccd';

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 70,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: INK,
    lineHeight: 1.4,
  },
  draft: {
    position: 'absolute',
    top: 14,
    left: 44,
    right: 44,
    textAlign: 'center',
    fontSize: 9,
    color: '#b3261e',
    letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { width: 92 },
  title: {
    fontFamily: 'Times-Italic',
    fontSize: 28,
    lineHeight: 1.1,
    color: GOLD,
    textAlign: 'right',
    marginBottom: 6,
  },
  meta: { textAlign: 'right', color: MUTED, marginTop: 2 },
  cols: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  box: { flex: 1, borderTopWidth: 1, borderTopColor: GOLD, paddingTop: 6 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.2, color: GOLD, textTransform: 'uppercase', marginBottom: 3 },
  strong: { fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  headRow: {
    flexDirection: 'row',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    fontSize: 7.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: 'right' },
  cPrice: { width: 70, textAlign: 'right' },
  cVat: { width: 40, textAlign: 'right' },
  cTotal: { width: 74, textAlign: 'right' },
  totals: { marginTop: 12, marginLeft: 'auto', width: 260 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 4,
    paddingTop: 5,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  section: { marginTop: 18 },
  sign: { marginTop: 28, borderWidth: 1, borderColor: GOLD, padding: 10, height: 70 },
  footer: {
    position: 'absolute',
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 7,
    color: MUTED,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

// Built-in PDF fonts have no narrow or non-breaking space (French amounts use them): plain spaces instead.
const plain = (text: string) => text.replace(/[  ]/g, ' ');

function logoPath() {
  const file = path.join(process.cwd(), 'public', 'brand', 'logo-mail.png');
  return existsSync(file) ? file : null;
}

type Props = { doc: BusinessDoc; t: Dictionary['documents']; locale: Locale; business: PdfBusiness };

function BusinessDocument({ doc, t, locale, business }: Props) {
  const money = (cents: number | null | undefined) => plain(formatMoney(cents ?? 0, locale));
  const day = (value: string | null | undefined) =>
    value
      ? plain(
          new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(value)),
        )
      : '—';
  const rate = (bp: number) => plain(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100));
  const prices = doc.kind !== 'deliveryNote';
  const credit = doc.kind === 'creditNote';
  const logo = logoPath();
  const address = [
    business.street,
    [business.postalCode && `L-${business.postalCode}`, business.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const legal = [
    business.legalName || business.name,
    address,
    business.vatNumber && `${t.vatNumber} ${business.vatNumber}`,
    business.rcs && `RCS ${business.rcs}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const heading = doc.kind === 'invoice' ? t.invoice : credit ? t.creditNote : t.deliveryNote;
  const sign = credit ? '- ' : '';
  const b = doc.billing;

  return (
    <Document title={`${heading} ${doc.number}`} author={business.name ?? 'Golden Grape'} language={locale}>
      <Page size="A4" style={s.page}>
        {!doc.legal?.trim() && doc.kind !== 'deliveryNote' && (
          <Text style={s.draft} fixed>
            {t.draftMark}
          </Text>
        )}
        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image takes no alt text */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.title}>{business.name}</Text>}
          <View>
            <Text style={s.title}>{heading}</Text>
            <Text style={s.meta}>{`${t.number} ${doc.number}`}</Text>
            <Text style={s.meta}>{`${t.issuedOn} ${day(doc.issuedAt)}`}</Text>
            {doc.dueAt ? <Text style={s.meta}>{`${t.dueOn} ${day(doc.dueAt)}`}</Text> : null}
            {doc.orderNumber ? <Text style={s.meta}>{`${t.order} ${doc.orderNumber}`}</Text> : null}
          </View>
        </View>

        <View style={s.cols}>
          <View style={s.box}>
            <Text style={s.eyebrow}>{business.name ?? 'Golden Grape'}</Text>
            {address ? <Text>{address}</Text> : null}
            {business.phone ? <Text>{business.phone}</Text> : null}
            {business.email ? <Text>{business.email}</Text> : null}
            {business.vatNumber ? <Text>{`${t.vatNumber} ${business.vatNumber}`}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.eyebrow}>{t.customer}</Text>
            {b.company ? <Text style={s.strong}>{b.company}</Text> : null}
            <Text style={b.company ? undefined : s.strong}>{b.name}</Text>
            {b.address ? <Text>{b.address}</Text> : null}
            {b.vatNumber ? <Text>{`${t.vatNumber} ${b.vatNumber}`}</Text> : null}
            {b.email ? <Text>{b.email}</Text> : null}
          </View>
        </View>

        {credit && (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.strong}>{interpolate(t.forInvoice, { number: doc.invoiceNumber ?? '' })}</Text>
            {doc.reason ? <Text style={s.muted}>{`${t.reason} : ${doc.reason}`}</Text> : null}
          </View>
        )}

        <View style={s.headRow}>
          <Text style={s.cDesc}>{t.description}</Text>
          <Text style={s.cQty}>{t.qty}</Text>
          {prices && <Text style={s.cPrice}>{t.unitPrice}</Text>}
          {prices && <Text style={s.cVat}>{t.vat}</Text>}
          {prices && <Text style={s.cTotal}>{t.lineTotal}</Text>}
        </View>
        {doc.lines.map((line, i) => (
          <View key={i} style={s.row} wrap={false}>
            <View style={s.cDesc}>
              <Text style={s.strong}>{line.name}</Text>
              {line.detail ? <Text style={s.muted}>{line.detail}</Text> : null}
              {prices && line.discountCents ? (
                <Text style={s.muted}>{`${t.discount} - ${money(line.discountCents)}`}</Text>
              ) : null}
            </View>
            <Text style={s.cQty}>{line.qty}</Text>
            {prices && <Text style={s.cPrice}>{money(line.unitPriceCents)}</Text>}
            {prices && <Text style={s.cVat}>{`${rate(line.vatBp ?? 0)} %`}</Text>}
            {prices && <Text style={s.cTotal}>{`${sign}${money(line.totalCents)}`}</Text>}
          </View>
        ))}

        {prices && doc.totals && (
          <View style={s.totals} wrap={false}>
            {doc.totals.deliveryCents ? (
              <View style={s.totalRow}>
                <Text>{t.delivery}</Text>
                <Text>{money(doc.totals.deliveryCents)}</Text>
              </View>
            ) : null}
            <View style={s.grand}>
              <Text>{credit ? t.credited : t.total}</Text>
              <Text>{`${sign}${money(doc.totals.totalCents)}`}</Text>
            </View>
            {(doc.totals.vatBreakdown ?? []).map((v) => (
              <View key={v.rateBp ?? 0} style={[s.totalRow, s.muted]}>
                <Text>
                  {interpolate(t.vatLine, { rate: rate(v.rateBp ?? 0), base: `${sign}${money(v.baseCents)}` })}
                </Text>
                <Text>{`${sign}${money(v.vatCents)}`}</Text>
              </View>
            ))}
            {doc.kind === 'invoice' && doc.paidBeforeCents ? (
              <View style={s.totalRow}>
                <Text>{t.paidBefore}</Text>
                <Text>{`- ${money(doc.paidBeforeCents)}`}</Text>
              </View>
            ) : null}
            {doc.kind === 'invoice' && doc.amountDueCents != null && doc.amountDueCents !== doc.totals.totalCents ? (
              <View style={[s.totalRow, s.strong]}>
                <Text>{t.amountDue}</Text>
                <Text>{money(doc.amountDueCents)}</Text>
              </View>
            ) : null}
          </View>
        )}

        {doc.kind === 'invoice' && (doc.amountDueCents ?? 0) > 0 && doc.account?.iban ? (
          <View style={s.section} wrap={false}>
            <Text style={s.eyebrow}>{t.payTo}</Text>
            <Text>{[doc.account.holder, doc.account.bankName].filter(Boolean).join(' · ')}</Text>
            <Text
              style={s.strong}
            >{`IBAN ${doc.account.iban}${doc.account.bic ? ` · BIC ${doc.account.bic}` : ''}`}</Text>
            <Text style={s.muted}>{interpolate(t.paymentRef, { number: doc.number })}</Text>
            {doc.paymentNote ? <Text style={s.muted}>{doc.paymentNote}</Text> : null}
          </View>
        ) : null}

        {doc.kind === 'deliveryNote' && (
          <View style={s.sign} wrap={false}>
            <Text style={s.eyebrow}>{t.received}</Text>
            <Text style={s.muted}>{t.receivedBy}</Text>
          </View>
        )}

        {doc.legal?.trim() && doc.kind !== 'deliveryNote' ? (
          <View style={s.section} wrap={false}>
            <Text style={s.muted}>{doc.legal}</Text>
          </View>
        ) : null}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${legal}   ·   ${interpolate(t.page, { n: pageNumber, total: totalPages })}`
          }
        />
      </Page>
    </Document>
  );
}

/** The document's PDF (A4) in its language. */
export function renderBusinessPdf(props: Props): Promise<Buffer> {
  return renderToBuffer(<BusinessDocument {...props} />);
}
