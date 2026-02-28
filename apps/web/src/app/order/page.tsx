import { Navbar } from '@/components/layout/Navbar';
import { OrderWizard } from '@/components/order/OrderWizard';
import { Footer } from '@/components/landing/Footer';
import { Recycle, ShieldCheck, Truck } from 'lucide-react';

export const metadata = {
  title: 'Order a Skip | B3Hub',
  description:
    'Book a waste skip online in 4 easy steps. Choose your location, waste type, size, and delivery date.',
};

const TRUST_BADGES = [
  {
    icon: Truck,
    label: 'Next-day delivery',
    sub: 'Order before 2pm',
  },
  {
    icon: ShieldCheck,
    label: 'Fully licensed',
    sub: 'Certified waste disposal',
  },
  {
    icon: Recycle,
    label: 'Eco-friendly',
    sub: '85% recycling rate',
  },
];

export default function OrderPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-linear-to-b from-red-50 via-white to-white">
        {/* Page hero */}
        <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center">
          <span className="inline-block rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-600 mb-4">
            📦 Online Skip Hire
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Order Your Skip in <span className="text-red-600">4 Simple Steps</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            From selecting your waste type to choosing a delivery date — we make skip hire fast,
            transparent, and hassle-free.
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {TRUST_BADGES.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <Icon className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                    <p className="text-xs text-gray-500">{b.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Wizard */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-24 pt-8">
          <OrderWizard />
        </section>
      </main>
      <Footer />
    </>
  );
}
