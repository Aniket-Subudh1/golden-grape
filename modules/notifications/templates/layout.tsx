import type { CSSProperties, ReactNode } from 'react';

// Shared e-mail frame (inline styles: most mail clients ignore stylesheets). Every e-mail reuses it.
// GG-013: the logo keeps its real proportions at a readable size (Outlook uses the width/height attributes, so both
// are set), and phones get smaller margins through one media query (clients without <style> keep the desktop look).
export const colors = { ink: '#1d1915', bone: '#f8f5ef', champagne: '#efe7d6', gold: '#c39a3c', goldDeep: '#96702a', muted: '#6b6257' };

export type MailBusiness = { name: string; street: string; postalCode: string; city: string; phone?: string | null; email?: string | null };

/** public/brand/logo-mail.png: 400 × 316, shown at half size for sharp screens. */
const LOGO = { width: 200, height: 158 };

const RESPONSIVE = `
@media only screen and (max-width: 620px) {
  .gg-body { padding: 0 !important; }
  .gg-pad { padding-left: 18px !important; padding-right: 18px !important; }
  .gg-label { width: 96px !important; }
}`;

type Props = {
  business: MailBusiness;
  logoUrl: string;
  /** Staff copies: a strip on top says it is an internal notification, so it is never mistaken for the customer's e-mail (GG-012). */
  staff?: string;
  children: ReactNode;
};

export function MailLayout({ business, logoUrl, staff, children }: Props) {
  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element -- e-mail HTML, rendered to a string: not a Next page */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <style>{RESPONSIVE}</style>
      </head>
      <body className="gg-body" style={{ margin: 0, padding: '32px 12px', background: colors.champagne, fontFamily: 'Helvetica, Arial, sans-serif', color: colors.ink }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 600, margin: '0 auto', background: colors.bone }}>
          <tbody>
            {staff && (
              <tr>
                <td className="gg-pad" style={{ background: colors.gold, padding: '10px 32px', fontSize: 12, letterSpacing: 1, color: colors.ink, textAlign: 'center' }}>
                  {staff}
                </td>
              </tr>
            )}
            <tr>
              <td style={{ background: colors.ink, padding: '28px 24px', textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- e-mail HTML: next/image cannot run in a mail client */}
                <img src={logoUrl} alt={business.name} width={LOGO.width} height={LOGO.height} style={{ display: 'inline-block', width: LOGO.width, maxWidth: '60%', height: 'auto', border: 0 }} />
              </td>
            </tr>
            <tr>
              <td className="gg-pad" style={{ padding: '36px 32px', fontSize: 15, lineHeight: 1.6 }}>
                {children}
              </td>
            </tr>
            <tr>
              <td className="gg-pad" style={{ borderTop: `1px solid ${colors.gold}`, padding: '20px 32px', fontSize: 12, lineHeight: 1.6, color: colors.muted, textAlign: 'center' }}>
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

export const heading: CSSProperties = { fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 26, lineHeight: 1.25, margin: '0 0 20px', color: colors.ink };

/** The order or reservation reference under the heading, in the reader's words ("Commande ORD-2026-00001"). */
export function Reference({ children }: { children: ReactNode }) {
  return <p style={{ margin: '-12px 0 20px', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldDeep }}>{children}</p>;
}

/** Two-column label/value table for request details. */
export function Details({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '24px 0', borderTop: `1px solid ${colors.champagne}` }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className="gg-label" style={{ padding: '10px 12px 10px 0', borderBottom: `1px solid ${colors.champagne}`, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldDeep, verticalAlign: 'top', width: 140 }}>
              {label}
            </td>
            <td style={{ padding: '10px 0', borderBottom: `1px solid ${colors.champagne}`, fontSize: 15, whiteSpace: 'pre-line' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
