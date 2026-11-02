import type { CSSProperties, ReactNode } from 'react';

// Shared e-mail frame (inline styles only: mail clients ignore stylesheets). Every e-mail reuses it.
export const colors = { ink: '#1d1915', bone: '#f8f5ef', champagne: '#efe7d6', gold: '#c39a3c', goldDeep: '#96702a', muted: '#6b6257' };

export type MailBusiness = { name: string; street: string; postalCode: string; city: string; phone?: string | null; email?: string | null };

export function MailLayout({ business, logoUrl, children }: { business: MailBusiness; logoUrl: string; children: ReactNode }) {
  return (
    <html>
      <body style={{ margin: 0, padding: '32px 12px', background: colors.champagne, fontFamily: 'Helvetica, Arial, sans-serif', color: colors.ink }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 600, margin: '0 auto', background: colors.bone }}>
          <tbody>
            <tr>
              <td style={{ background: colors.ink, padding: '28px 32px', textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- e-mail HTML: next/image cannot run in a mail client */}
                <img src={logoUrl} alt={business.name} width={72} height={72} style={{ display: 'inline-block' }} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: '36px 32px', fontSize: 15, lineHeight: 1.6 }}>{children}</td>
            </tr>
            <tr>
              <td style={{ borderTop: `1px solid ${colors.gold}`, padding: '20px 32px', fontSize: 12, lineHeight: 1.6, color: colors.muted, textAlign: 'center' }}>
                {business.name} · {business.street} · L-{business.postalCode} {business.city}
                {business.phone && <> · {business.phone}</>}
                {business.email && <> · {business.email}</>}
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export const heading: CSSProperties = { fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 26, margin: '0 0 20px', color: colors.ink };

/** Two-column label/value table for request details. */
export function Details({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '24px 0', borderTop: `1px solid ${colors.champagne}` }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ padding: '10px 12px 10px 0', borderBottom: `1px solid ${colors.champagne}`, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldDeep, verticalAlign: 'top', width: 140 }}>
              {label}
            </td>
            <td style={{ padding: '10px 0', borderBottom: `1px solid ${colors.champagne}`, fontSize: 15, whiteSpace: 'pre-line' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
