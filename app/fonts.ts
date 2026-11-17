import { Cormorant_Garamond, Inter } from 'next/font/google';

// The website's two typefaces (05 §1), self-hosted by next/font: the public site and the staff screens.
export const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});
export const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
