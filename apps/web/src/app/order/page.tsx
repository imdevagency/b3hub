/**
 * Public order entry page — /order
 * Authenticated users are sent to the dashboard; unauthenticated visitors see a
 * marketing teaser and are invited to log in or register.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/landing/Footer';
import { HardHat, Package, Recycle, ShieldCheck, Trash2, Truck } from 'lucide-react';

const SERVICES = [
  {
    icon: HardHat,
    label: 'Materiāli',
    desc: 'Smiltis, grants, šķembas — piegāde uz objektu',
    color: 'bg-amber-500/10 text-amber-700',
  },
  {
    icon: Package,
    label: 'Konteineri',
    desc: 'Konteiners piegādāts uz jūsu vietu',
    color: 'bg-emerald-500/10 text-emerald-700',
  },
  {
    icon: Trash2,
    label: 'Utilizācija',
    desc: 'Kravas auto iekrauj un aizved atkritumus',
    color: 'bg-red-500/10 text-red-700',
  },
  {
    icon: Truck,
    label: 'Transports',
    desc: 'Jebkuras kravas no punkta A uz B',
    color: 'bg-indigo-500/10 text-indigo-700',
  },
];

const TRUST_BADGES = [
  { icon: Truck, label: 'Piegāde nākamajā dienā', sub: 'Pasūtīiet līdz plkst. 14:00' },
  { icon: ShieldCheck, label: 'Licenzēts operators', sub: 'Sertificēta atkritumu izvešana' },
  { icon: Recycle, label: 'Videi draudzīgs', sub: '85% pārstrādes rādītājs' },
];

export default function OrderPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard/order');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-primary/5 via-white to-white">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-10 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-5">
            Celtniecības loģistikas platforma
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Pasūtiet materiālus un transportu <span className="text-primary">dažos soļos</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Materiālu piegāde, atkritumu izvešana, konteineri un kravu transports — viss vienā
            platformā ar pārskatāmām cenām.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-white hover:bg-primary/90 transition-colors"
            >
              Pieteikties
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-8 py-3.5 text-base font-bold text-gray-800 hover:bg-gray-50 transition-colors"
            >
              Reģistrēties
            </Link>
          </div>
        </section>

        {/* Service overview */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 text-center"
              >
                <div
                  className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-bold text-gray-900">{s.label}</p>
                <p className="mt-1 text-xs text-gray-500 leading-snug">{s.desc}</p>
              </div>
            );
          })}
        </section>

        {/* Trust badges */}
        <section className="mx-auto max-w-3xl px-6 pb-24 flex flex-wrap justify-center gap-8">
          {TRUST_BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.sub}</p>
                </div>
              </div>
            );
          })}
        </section>
      </main>
      <Footer />
    </>
  );
}
