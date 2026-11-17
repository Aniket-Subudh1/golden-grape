import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Toaster } from '@/components/ui/sonner';
import { sans } from '../../fonts';
import '../../globals.css';
import './staff.css';
import { ToastCheck } from '@/components/staff/success-tick';

// The staff app (05 §5): its own document, outside the website's layout, in the back office's look (staff.css). Per user and
// request-time, like the admin: every page checks the session with Payload before rendering (session.ts).
export const instant = false;

export const metadata: Metadata = {
  title: { default: 'Golden Grape · Équipe', template: '%s · Golden Grape' },
  robots: { index: false, follow: false },
  manifest: '/staff/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'GG Équipe', statusBarStyle: 'default' },
  icons: { apple: '/staff/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(max-width: 767px)', color: '#16181c' }, { color: '#eaeef5' }],
};

export default async function StaffRootLayout({ children }: LayoutProps<'/staff'>) {
  await connection();
  return (
    <html lang="fr" className={sans.variable}>
      <body className="gg-staff bg-bone text-ink min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" icons={{ success: <ToastCheck /> }} />
      </body>
    </html>
  );
}
