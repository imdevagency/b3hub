import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const materials = [
  {
    emoji: '🪨',
    name: 'Grants',
    latvian: 'Grants',
    fractions: '0/30 · 0/50 · 0/100',
    uses: 'Ceļu segums, pamatu bedres, drenāža',
    color: 'bg-stone-100',
  },
  {
    emoji: '🏖️',
    name: 'Smiltis',
    latvian: 'Smiltis',
    fractions: '0/2 · 0/4',
    uses: 'Betonēšana, izlīdzināšana, spēļu laukumi',
    color: 'bg-yellow-50',
  },
  {
    emoji: '🪨',
    name: 'Šķembas',
    latvian: 'Šķembas',
    fractions: '8/16 · 16/32 · 32/63',
    uses: 'Betona maisījumi, filtrācijas slāņi',
    color: 'bg-gray-100',
  },
  {
    emoji: '🟤',
    name: 'Dolomīts',
    latvian: 'Dolomīts',
    fractions: '0/32 · 0/56',
    uses: 'Ceļu pamati, stāvlaukumi, privātceļi',
    color: 'bg-amber-50',
  },
  {
    emoji: '🌱',
    name: 'Augsne',
    latvian: 'Augsne / Veidaugsne',
    fractions: 'Viegla · Vidēja · Smagā',
    uses: 'Apzaļumošana, dārzi, uzbērumi',
    color: 'bg-green-50',
  },
  {
    emoji: '♻️',
    name: 'Pārstrādāts grants',
    latvian: 'RC Grants',
    fractions: '0/32 · 0/63',
    uses: 'Ceļu pamati, pieturas laukumi, atkritumi uz uzbēruma',
    color: 'bg-teal-50',
  },
];

export function Materials() {
  return (
    <section id="materials" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-primary uppercase tracking-wide">
            Materiālu katalogs
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Visi bierrūpniecības materiāli vienā vietā
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            No grants līdz pārstrādātam betonam — pasūtiet ar piegādi uz objektu vai izņemiet
            tuvākajā B3 laukumā.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <div
              key={m.name}
              className={`group rounded-2xl border border-gray-200 ${m.color} p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{m.emoji}</span>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {m.fractions}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{m.latvian}</h3>
              <p className="mt-1 text-sm text-gray-500">{m.uses}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-12 text-center">
          <Link
            href={`${APP_URL}/register`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Skatīt pilnu katalogu →
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            Cenas no piegādātājiem tiek atjauninātas reāllaikā
          </p>
        </div>
      </div>
    </section>
  );
}
