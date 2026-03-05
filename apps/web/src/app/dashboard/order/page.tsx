import Link from 'next/link';
import { ArrowRight, CheckCircle2, Package, Recycle, ShieldCheck, Truck } from 'lucide-react';

// ── Material categories preview ───────────────────────────────────────────────
const MATERIAL_CATEGORIES = [
  { emoji: '🪨', label: 'Agregāti' },
  { emoji: '⚙️', label: 'Metāls' },
  { emoji: '🪵', label: 'Koks' },
  { emoji: '🧱', label: 'Betons' },
  { emoji: '🏗️', label: 'Veidnes' },
  { emoji: '🔧', label: 'Citi' },
];

// ── Container size preview ────────────────────────────────────────────────────
const SKIP_SIZES = [
  { label: 'Mini', size: '2 yd³', price: '€89' },
  { label: 'Midi', size: '4 yd³', price: '€129' },
  { label: 'Builders', size: '6 yd³', price: '€169' },
  { label: 'Large', size: '8 yd³', price: '€199' },
];

export default function OrderHubPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pasūtīt</h1>
        <p className="mt-1 text-sm text-gray-500">
          Izvēlieties, ko vēlaties pasūtīt — materiālus vai atkritumu konteineru.
        </p>
      </div>

      {/* Service cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── Materials card ──────────────────────────────────────────── */}
        <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-red-200 transition-all duration-200 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-red-400" />

          <div className="flex flex-col flex-1 p-6">
            {/* Icon + title */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 group-hover:bg-red-100 transition-colors">
                <Package className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Materiāli</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Pārlūkojiet 500+ materiālus no pārbaudītiem piegādātājiem
                </p>
              </div>
            </div>

            {/* Category chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              {MATERIAL_CATEGORIES.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {c.emoji} {c.label}
                </span>
              ))}
            </div>

            {/* Feature list */}
            <ul className="mt-5 space-y-2">
              {[
                'Salīdziniet cenas starp piegādātājiem',
                'Pievienojiet vairākus materiālus grozam',
                'Rēķini un pasūtījumu vēsture',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-auto pt-6">
              <Link
                href="/dashboard/catalog"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                Skatīt Katalogu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Skip hire card ───────────────────────────────────────────── */}
        <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-slate-400 transition-all duration-200 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-700 to-slate-500" />

          <div className="flex flex-col flex-1 p-6">
            {/* Icon + title */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors">
                <Truck className="h-6 w-6 text-slate-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Konteineru Noma</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Atkritumu konteineri piegādāti nākamajā dienā
                </p>
              </div>
            </div>

            {/* Size + price grid */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {SKIP_SIZES.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.size}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{s.price}</p>
                </div>
              ))}
            </div>

            {/* Feature list */}
            <ul className="mt-5 space-y-2">
              {[
                'Salīdziniet cenas starp pārvadātājiem',
                'GPS adrese vai manuāla ievade',
                'Pilnīgi licenzēta atkritumu izvešana',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-auto pt-6">
              <Link
                href="/dashboard/order/skip-hire"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 transition-colors"
              >
                Pasūtīt Konteineru
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap gap-6 rounded-xl border border-gray-100 bg-gray-50 px-6 py-4">
        {[
          { icon: Truck, label: 'Piegāde nākamajā dienā', sub: 'Pasūtīiet līdz 14:00' },
          {
            icon: ShieldCheck,
            label: 'Verificēti piegādātāji',
            sub: 'Visi partneri ir pārbaudīti',
          },
          { icon: Recycle, label: 'Videi draudzīgs', sub: '85% pārstrādes rādītājs' },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200">
                <Icon className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                <p className="text-xs text-gray-500">{b.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
