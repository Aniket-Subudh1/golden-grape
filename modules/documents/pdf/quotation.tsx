import { existsSync } from 'node:fs';
import path from 'node:path';
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { type Dictionary, interpolate, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { Quotation } from '@/payload-types';

// The quotation as a PDF (A4), in the quotation's language: what is attached to the e-mail and, once accepted, the
// signed copy kept in the customer's file. Built-in PDF fonts (Helvetica, Times) with the house gold; the labels come
// from the `documents` dictionary.

export type PdfBusiness = {
  name?: string | null;
  legalName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  rcs?: string | null;
};

export type PdfSignature = { name: string; at: string; ip: string; sentSha256?: string | null };

// Words are never cut with a hyphen ("Bis-sen"): a line breaks between words only.
Font.registerHyphenationCallback((word) => [word]);

const GOLD = '#8f6a24';
const INK = '#1c1a17';
const MUTED = '#6b6559';
const LINE = '#e3dccd';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 9.5, color: INK, lineHeight: 1.4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { width: 92 },
  title: { fontFamily: 'Times-Italic', fontSize: 28, lineHeight: 1.1, color: GOLD, textAlign: 'right', marginBottom: 6 },
  meta: { textAlign: 'right', color: MUTED, marginTop: 2 },
  cols: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  box: { flex: 1, borderTopWidth: 1, borderTopColor: GOLD, paddingTop: 6 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.2, color: GOLD, textTransform: 'uppercase', marginBottom: 3 },
  strong: { fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  headRow: { flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: GOLD, fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: 'right' },
  cPrice: { width: 74, textAlign: 'right' },
  cVat: { width: 42, textAlign: 'right' },
  cTotal: { width: 78, textAlign: 'right' },
  totals: { marginTop: 12, marginLeft: 'auto', width: 250 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: GOLD, marginTop: 4, paddingTop: 5, fontSize: 12, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 18 },
  sign: { marginTop: 20, borderWidth: 1, borderColor: GOLD, padding: 10 },
  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, fontSize: 7, color: MUTED, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
});

// Built-in PDF fonts have no narrow or non-breaking space (French amounts use them): plain spaces instead.
const plain = (text: string) => text.replace(/[  ]/g, ' ');

function logoPath() {
  const file = path.join(process.cwd(), 'public', 'brand', 'logo-mail.png');
  return existsSync(file) ? file : null;
}

type Props = { q: Quotation; t: Dictionary['documents']; locale: Locale; business: PdfBusiness; signature?: PdfSignature | null };

function QuotationDocument({ q, t, locale, business, signature }: Props) {
  const money = (cents: number | null | undefined) => plain(formatMoney(cents ?? 0, locale));
  const day = (value: string | null | undefined) => (value ? plain(new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Luxembourg' }).format(new Date(value))) : '—');
  const rate = (bp: number) => plain(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100));
  const qty = (n: number) => plain(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n));
  const logo = logoPath();
  const totals = q.totals;
  const address = [business.street, [business.postalCode && `L-${business.postalCode}`, business.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const legal = [business.legalName || business.name, address, business.vatNumber && `${t.vatNumber} ${business.vatNumber}`, business.rcs && `RCS ${business.rcs}`].filter(Boolean).join(' · ');

  return (
    <Document title={`${t.title} ${q.number ?? ''}`.trim()} author={business.name ?? 'Golden Grape'} language={locale}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          {/* react-pdf's Image takes no alt text (a PDF image, not an <img>). */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.title}>{business.name}</Text>}
          <View>
            <Text style={s.title}>{t.title}</Text>
            <Text style={s.meta}>{q.number ? `${t.number} ${q.number}` : t.draft}</Text>
            <Text style={s.meta}>{`${t.issuedOn} ${day(q.sentAt ?? q.updatedAt)}`}</Text>
            <Text style={s.meta}>{`${t.validUntil} ${day(q.validUntil)}`}</Text>
          </View>
        </View>

        <View style={s.cols}>
          <View style={s.box}>
            <Text style={s.eyebrow}>{business.name ?? 'Golden Grape'}</Text>
            {address ? <Text>{address}</Text> : null}
            {business.phone ? <Text>{business.phone}</Text> : null}
            {business.email ? <Text>{business.email}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.eyebrow}>{t.customer}</Text>
            <Text style={s.strong}>{q.contact?.name}</Text>
            {q.contact?.company ? <Text>{q.contact.company}</Text> : null}
            {q.contact?.email ? <Text>{q.contact.email}</Text> : null}
            {q.contact?.phone ? <Text>{q.contact.phone}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.eyebrow}>{t.event}</Text>
            <Text>{[day(q.event?.date), q.event?.time].filter(Boolean).join(' · ')}</Text>
            {q.event?.guests ? <Text>{interpolate(t.guests, { count: q.event.guests })}</Text> : null}
            {q.event?.location ? <Text>{q.event.location}</Text> : null}
          </View>
        </View>

        <View style={s.headRow}>
          <Text style={s.cDesc}>{t.description}</Text>
          <Text style={s.cQty}>{t.qty}</Text>
          <Text style={s.cPrice}>{t.unitPrice}</Text>
          <Text style={s.cVat}>{t.vat}</Text>
          <Text style={s.cTotal}>{t.lineTotal}</Text>
        </View>
        {(q.lines ?? []).map((line, i) => (
          <View key={line.id ?? i} style={s.row} wrap={false}>
            <View style={s.cDesc}>
              <Text style={s.strong}>{line.description}</Text>
              {line.detail ? <Text style={s.muted}>{line.detail}</Text> : null}
            </View>
            <Text style={s.cQty}>{qty(line.qty)}</Text>
            <Text style={s.cPrice}>{money(line.unitPriceCents)}</Text>
            <Text style={s.cVat}>{`${rate(line.vatBp ?? 0)} %`}</Text>
            <Text style={s.cTotal}>{money(line.totalCents)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {totals?.discountCents ? (
            <>
              <View style={s.totalRow}>
                <Text>{t.subtotal}</Text>
                <Text>{money(totals.subtotalCents)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text>{t.discount}</Text>
                <Text>{`- ${money(totals.discountCents)}`}</Text>
              </View>
            </>
          ) : null}
          <View style={s.grand}>
            <Text>{t.total}</Text>
            <Text>{money(totals?.totalCents)}</Text>
          </View>
          {(totals?.vatBreakdown ?? []).map((v) => (
            <View key={v.rateBp ?? 0} style={[s.totalRow, s.muted]}>
              <Text>{interpolate(t.vatLine, { rate: rate(v.rateBp ?? 0), base: money(v.baseCents) })}</Text>
              <Text>{money(v.vatCents)}</Text>
            </View>
          ))}
        </View>

        {q.conditions ? (
          <View style={s.section} wrap={false}>
            <Text style={s.eyebrow}>{t.conditions}</Text>
            <Text>{q.conditions}</Text>
          </View>
        ) : null}

        <View style={s.sign} wrap={false}>
          <Text style={s.eyebrow}>{t.agreement}</Text>
          {signature ? (
            <>
              <Text style={s.strong}>{interpolate(t.signedBy, { name: signature.name })}</Text>
              <Text>
                {interpolate(t.signedOn, {
                  date: day(signature.at),
                  time: plain(new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'Europe/Luxembourg' }).format(new Date(signature.at))),
                })}
              </Text>
              <Text style={s.muted}>{interpolate(t.signedIp, { ip: signature.ip })}</Text>
              {signature.sentSha256 ? <Text style={s.muted}>{interpolate(t.signedHash, { hash: signature.sentSha256 })}</Text> : null}
            </>
          ) : (
            <Text style={s.muted}>{t.howToSign}</Text>
          )}
        </View>

        <Text style={s.footer} fixed>
          {legal}
        </Text>
      </Page>
    </Document>
  );
}

/** The quotation's PDF; with `signature`, the signed copy (name, date and time, IP, fingerprint of the sent PDF). */
export function renderQuotationPdf(props: Props): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument {...props} />);
}
