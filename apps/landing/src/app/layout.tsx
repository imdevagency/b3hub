import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'B3Hub — Celtniecības loģistikas platforma',
    template: '%s | B3Hub',
  },
  description:
    'B3Hub savieno pircējus, piegādātājus un pārvadātājus vienā platformā. Pasūtiet materiālus, izsekojiet piegādēm un optimizējiet piegādes ķēdi.',
  openGraph: {
    type: 'website',
    locale: 'lv_LV',
    siteName: 'B3Hub',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lv" className={geist.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
