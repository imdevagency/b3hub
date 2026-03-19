/**
 * HowItWorks landing section.
 * Numbered steps explaining the platform workflow for buyers and suppliers.
 */
import Link from 'next/link';
import { ShoppingCart, Package, Truck } from 'lucide-react';

const roles = [
  {
    icon: ShoppingCart,
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Pircējs',
    tagline: 'Celtniecības uzņēmumi un privātpersonas',
    steps: [
      'Reģistrējieties kā pircējs — bez maksas',
      'Pārlūkojiet materiālu katalogu',
      'Pasūtiet ar piegādi uz objektu',
      'Izsekojiet statusam reāllaikā',
    ],
    cta: { label: 'Sākt pirkt', href: '/register' },
  },
  {
    icon: Package,
    color: 'bg-red-50',
    iconColor: 'text-primary',
    title: 'Pārdevējs',
    tagline: 'Karjeru un izgāztuvju operatori',
    steps: [
      'Pieteicieties kā materiālu piegādātājs',
      'Publicējiet savus materiālus un cenas',
      'Saņemiet pasūtījumus tieši no klientiem',
      'Izrakstiet rēķinus digitāli',
    ],
    cta: { label: 'Kļūt par pārdevēju', href: '/apply' },
    featured: true,
  },
  {
    icon: Truck,
    color: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Pārvadātājs',
    tagline: 'Kravas transporta uzņēmumi un šoferi',
    steps: [
      'Pieteicieties kā pārvadātājs',
      'Pārlūkojiet pieejamos transporta darbus',
      'Pieņemiet darbus pēc savas izvēles',
      'Pelniet par katru piegādi',
    ],
    cta: { label: 'Kļūt par pārvadātāju', href: '/apply' },
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-primary uppercase tracking-wide">
            Kā tas darbojas
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Viena platforma — trīs lomas
          </p>
          <p className="mt-4 text-lg text-gray-600">
            Neatkarīgi no jūsu lomas B3Hub nodrošina visu, kas nepieciešams efektīvai darbībai.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.title}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                role.featured
                  ? 'border-red-200 shadow-lg ring-1 ring-red-100'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {role.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-bold text-white shadow">
                    Populārākais
                  </span>
                </div>
              )}

              {/* Icon + title */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center`}
                >
                  <role.icon className={`h-6 w-6 ${role.iconColor}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{role.title}</p>
                  <p className="text-sm text-gray-500">{role.tagline}</p>
                </div>
              </div>

              {/* Steps */}
              <ol className="space-y-3 flex-1 mb-8">
                {role.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{step}</span>
                  </li>
                ))}
              </ol>

              {/* CTA */}
              <Link
                href={role.cta.href}
                className={`block w-full text-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                  role.featured
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-gray-300 text-gray-700 hover:border-primary/50 hover:text-primary'
                }`}
              >
                {role.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
