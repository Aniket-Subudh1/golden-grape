import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Toaster } from '@/components/ui/sonner';
import { sans, serif } from '../../fonts';
import '../../globals.css';

// The phone screens of the back office (05 §5): their own document, outside the website's layout. Per user and
// request-time, like the admin: every page checks the session with Payload before rendering (session.ts).
export const instant = false;

export const metadata: Metadata = {
  title: { default: 'Golden Grape · Équipe', template: '%s · Golden Grape' },
  robots: { index: false, follow: false },
  manifest: '/staff/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'GG Équipe', statusBarStyle: 'default' },
  icons: { apple: '/staff/icon-192.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f7f4ee' };

export default async function StaffRootLayout({ children }: LayoutProps<'/staff'>) {
  await connection();
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-bone text-ink antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
