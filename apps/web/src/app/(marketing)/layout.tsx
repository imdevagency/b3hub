import type { Metadata } from 'next';
import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';

export const metadata: Metadata = {
  title: {
    default: 'Bilt — Celtniecības loģistikas platforma',
    template: '%s | Bilt',
  },
  description:
    'Bilt savieno pircējus, piegādātājus un pārvadātājus vienā platformā. Pasūtiet materiālus, izsekojiet piegādēm un optimizējiet piegādes ķēdi.',
  openGraph: {
    type: 'website',
    locale: 'lv_LV',
    siteName: 'Bilt',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
