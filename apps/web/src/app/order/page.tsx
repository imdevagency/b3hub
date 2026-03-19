/**
 * Public order entry page — /order
 * Redirects unauthenticated visitors to login; authenticated users to the order wizard.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/Navbar';
import { OrderWizard } from '@/components/order/OrderWizard';
import { Footer } from '@/components/landing/Footer';
import { Recycle, ShieldCheck, Truck } from 'lucide-react';

// metadata export removed — not allowed in client components

const TRUST_BADGES = [
  {
    icon: Truck,
    label: 'Piegāde nākamajā dienā',
    sub: 'Pasūtīiet līdz plkst. 14:00',
  },
  {
    icon: ShieldCheck,
    label: 'Pilnibīgi licenzēts',
    sub: 'Sertificēta atkritumu izvešana',
  },
  {
    icon: Recycle,
    label: 'Videi draudzīgs',
    sub: '85% pārstrādes rādītājs',
  },
];

export default function OrderPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard/order');
    }
  }, [user, isLoading, router]);

  // Avoid flash of public page while auth loads or redirect is in flight
  if (isLoading || user) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-linear-to-b from-primary/5 via-white to-white">
        {/* Page hero */}
        <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
            📦 Konteinera Noma Tiešsaistē
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Pasūtīiet Savu Konteineru <span className="text-primary">4 Vienkiršos Soļos</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            No atkritumu veida izvēles līdz piegādes datuma noteikšanai — mēs padarām konteinera
            nomu ātru, pārskatāmu un bez saražģījumiem.
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {TRUST_BADGES.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
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
