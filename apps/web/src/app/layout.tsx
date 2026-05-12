/**
 * Root Next.js layout.
 * Wraps the entire app with AuthProvider, CartProvider, ModeProvider,
 * global fonts, and the Toaster notification component.
 */
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Bilt — Celtniecības loģistikas platforma',
  description:
    'Pasūtiet celtniecības materiālus, konteinerus, transportu un utilizāciju. Cenas redzamas uzreiz, pavadzīmes automātiski.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lv">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
