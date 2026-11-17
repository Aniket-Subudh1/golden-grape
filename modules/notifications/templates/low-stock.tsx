import { type Dictionary, interpolate } from '@/lib/i18n';
import { colors, heading, MailLayout, type MailBusiness } from './layout';

export type LowStockRow = { name: string; sku: string; onHand: number; threshold: number; supplier: string | null; suggestion: string };

const cell = { padding: '8px 6px', borderBottom: `1px solid ${colors.champagne}`, fontSize: 14, verticalAlign: 'top' } as const;

/** The morning e-mail to the stock contact (M3.1 T6): every size at or below its level, with its supplier. */
export function LowStockDigest({ t, business, logoUrl, rows, link }: { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; rows: LowStockRow[]; link: string }) {
  return (
    <MailLayout business={business} logoUrl={logoUrl} staff={t.staffBanner}>
      <h1 style={heading}>{interpolate(t.lowStock.subject, { count: rows.length })}</h1>
      <p>{t.lowStock.intro}</p>
      <table cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[t.lowStock.item, t.lowStock.onHand, t.lowStock.level, t.lowStock.supplier].map((h) => (
              <th key={h} style={{ ...cell, textAlign: 'left', fontSize: 12, color: colors.muted, fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku}>
              <td style={cell}>
                {r.name}
                <br />
                <span style={{ fontSize: 12, color: colors.muted }}>{r.sku}</span>
              </td>
              <td style={{ ...cell, color: r.onHand <= 0 ? '#9b1c1c' : colors.ink }}>{r.onHand}</td>
              <td style={cell}>{r.threshold}</td>
              <td style={cell}>
                {r.supplier ?? '—'}
                <br />
                <span style={{ fontSize: 12, color: colors.muted }}>{r.suggestion}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 24 }}>
        <a href={link} style={{ color: colors.goldDeep }}>
          {t.lowStock.open}
        </a>
      </p>
    </MailLayout>
  );
}
