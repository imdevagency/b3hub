import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Cenas',
  description:
    'Pārredzamas B3Hub cenas pircējiem, piegādātājiem un pārvadātājiem. Bez slēptajām maksām.',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const plans = [
  {
    name: 'Pircējs',
    price: 'Bezmaksas',
    description: 'Pasūtiet materiālus un izsekojiet piegādēm bez abonēšanas maksas.',
    href: `${APP_URL}/register`,
    cta: 'Reģistrēties',
    featured: false,
    features: [
      'Neierobežoti pasūtījumi',
      'Reāllaika piegāžu izsekošana',
      'Digitālie piegādes dokumenti',
      'Vēsture un rēķini',
      'Mobilā lietotne (iOS & Android)',
    ],
  },
  {
    name: 'Piegādātājs',
    price: '€49',
    period: '/mēnesī',
    description: 'Publicējiet materiālus, saņemiet pasūtījumus un pārvaldiet savu biznesu.',
    href: `${APP_URL}/apply`,
    cta: 'Pieteikties',
    featured: true,
    features: [
      'Neierobežoti materiālu ieraksti',
      'Pasūtījumu pārvaldība',
      'Automātiskie rēķini',
      'Piegάdes koordinācija',
      'Analītika un pārskati',
      'Prioritārs atbalsts',
    ],
  },
  {
    name: 'Pārvadātājs',
    price: 'Komisija',
    description: 'Mēs iekasējam nelielu komisiju no katras sekmīgas piegādes.',
    href: `${APP_URL}/apply`,
    cta: 'Pieteikties',
    featured: false,
    features: [
      'Piekļuve visiem transporta darbiem',
      'Darbu izvēle brīvi',
      'Ātrie maksājumi',
      'Digitālie pavadraksti',
      'Maršrutu plānošana',
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Vienkāršas, pārredzamas cenas
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Izvēlieties plānu, kas atbilst jūsu lomai platformā. Nav slēpto maksu.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl p-8 ${
                    plan.featured
                      ? 'bg-primary text-white shadow-2xl ring-2 ring-primary'
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-white px-4 py-1 text-xs font-bold text-primary shadow">
                        Populārākais
                      </span>
                    </div>
                  )}
                  <h2
                    className={`text-lg font-semibold ${plan.featured ? 'text-white' : 'text-gray-900'}`}
                  >
                    {plan.name}
                  </h2>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span
                      className={`text-4xl font-bold tracking-tight ${plan.featured ? 'text-white' : 'text-gray-900'}`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className={`text-sm ${plan.featured ? 'text-white/80' : 'text-gray-500'}`}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-4 text-sm ${plan.featured ? 'text-white/80' : 'text-gray-600'}`}
                  >
                    {plan.description}
                  </p>

                  <ul className="mt-8 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <Check
                          className={`h-5 w-5 shrink-0 mt-0.5 ${plan.featured ? 'text-white' : 'text-primary'}`}
                        />
                        <span
                          className={`text-sm ${plan.featured ? 'text-white/90' : 'text-gray-600'}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`mt-10 block w-full text-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                      plan.featured
                        ? 'bg-white text-primary hover:bg-white/90'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
