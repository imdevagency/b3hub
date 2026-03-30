import Link from 'next/link';
import { ShoppingCart, Package, Truck } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const roles = [
  {
    icon: ShoppingCart,
    title: 'Pircējs',
    tagline: 'Celtniecības uzņēmumi un privātpersonas',
    steps: [
      'Reģistrējieties kā pircējs — bez maksas',
      'Pārlūkojiet materiālu katalogu',
      'Pasūtiet ar piegādi uz objektu',
      'Izsekojiet statusam reāllaikā',
    ],
    cta: { label: 'Sākt pirkt', href: `${APP_URL}/register` },
  },
  {
    icon: Package,
    title: 'Pārdevējs',
    tagline: 'Karjeru un izgāztuvju operatori',
    steps: [
      'Pieteicieties kā materiālu piegādātājs',
      'Publicējiet savus materiālus un cenas',
      'Saņemiet pasūtījumus tieši no klientiem',
      'Izrakstiet rēķinus digitāli',
    ],
    cta: { label: 'Kļūt par pārdevēju', href: `${APP_URL}/apply` },
    featured: true,
  },
  {
    icon: Truck,
    title: 'Pārvadātājs',
    tagline: 'Kravas transporta uzņēmumi un šoferi',
    steps: [
      'Pieteicieties kā pārvadātājs',
      'Pārlūkojiet pieejamos transporta darbus',
      'Pieņemiet darbus pēc savas izvēles',
      'Pelniet par katru piegādi',
    ],
    cta: { label: 'Kļūt par pārvadātāju', href: `${APP_URL}/apply` },
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-32 sm:py-40 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-24">
          <p className="mt-2 text-4xl font-bold tracking-tighter text-black sm:text-5xl">
            Viena platforma. Trīs lomas.
          </p>
          <p className="mt-6 text-lg text-gray-500">
            Neatkarīgi no jūsu lomas B3Hub nodrošina visu nepieciešamo vienotā sistēmā.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.title}
              className={`relative border p-8 flex flex-col ${
                role.featured
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-black'
              }`}
            >
              {role.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-white px-3 py-1 text-xs font-bold tracking-widest text-black border border-black uppercase">
                    Piegādātājiem
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-8">
                <div
                  className={`w-12 h-12 flex items-center justify-center border ${
                    role.featured ? 'border-white/20' : 'border-gray-200'
                  }`}
                >
                  <role.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold">{role.title}</p>
                  <p className={`text-sm ${role.featured ? 'text-gray-400' : 'text-gray-500'}`}>
                    {role.tagline}
                  </p>
                </div>
              </div>

              <ol className="space-y-4 flex-1 mb-10">
                {role.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-6 h-6 text-xs font-bold flex items-center justify-center border ${
                        role.featured ? 'border-white/20 text-white' : 'border-gray-200 text-black'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-sm pt-0.5 ${role.featured ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <Link
                href={role.cta.href}
                className={`block w-full text-center px-5 py-3 text-sm font-medium transition-colors border ${
                  role.featured
                    ? 'bg-white text-black hover:bg-gray-100'
                    : 'bg-black text-white hover:bg-gray-800'
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
