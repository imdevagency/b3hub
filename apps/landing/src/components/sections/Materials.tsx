import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const materials = [
  {
    emoji: '🪨',
    name: 'Grants',
    latvian: 'Grants',
    fractions: '0/30 · 0/50 · 0/100',
    uses: 'Ceļu segums, pamatu bedres, drenāža',
  },
  {
    emoji: '🏖️',
    name: 'Smiltis',
    latvian: 'Smiltis',
    fractions: '0/2 · 0/4',
    uses: 'Betonēšana, izlīdzināšana, spēļu laukumi',
  },
  {
    emoji: '🪨',
    name: 'Šķembas',
    latvian: 'Šķembas',
    fractions: '8/16 · 16/32 · 32/63',
    uses: 'Betona maisījumi, filtrācijas slāņi',
  },
  {
    emoji: '🟤',
    name: 'Dolomīts',
    latvian: 'Dolomīts',
    fractions: '0/32 · 0/56',
    uses: 'Ceļu pamati, stāvlaukumi, privātceļi',
  },
  {
    emoji: '🌱',
    name: 'Augsne',
    latvian: 'Augsne / Veidaugsne',
    fractions: 'Viegla · Vidēja · Smagā',
    uses: 'Apzaļumošana, dārzi, uzbērumi',
  },
  {
    emoji: '♻️',
    name: 'Pārstrādāts grants',
    latvian: 'RC Grants',
    fractions: '0/32 · 0/63',
    uses: 'Ceļu pamati, pieturas laukumi, atkritumi uz uzbēruma',
  },
];

export function Materials() {
  return (
    <section id="materials" className="bg-gray-50 py-32 sm:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-24">
          <p className="mt-2 text-4xl font-bold tracking-tighter text-black sm:text-5xl">
            Materiālu katalogs.
          </p>
          <p className="mt-6 text-lg text-gray-500">
            No grants līdz pārstrādātam betonam — pasūtiet ar piegādi uz objektu vai izņemiet
            tuvākajā B3 laukumā.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-px bg-gray-200 border border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <div key={m.name} className="bg-white p-8 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-8">
                <span className="text-3xl grayscale">{m.emoji}</span>
                <span className="border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-500 tracking-widest uppercase">
                  {m.fractions}
                </span>
              </div>
              <h3 className="text-xl font-bold text-black">{m.latvian}</h3>
              <p className="mt-2 text-sm text-gray-500">{m.uses}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-16 text-center">
          <Link
            href={`${APP_URL}/register`}
            className="inline-flex items-center justify-center bg-black px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Skatīt pilnu katalogu →
          </Link>
          <p className="mt-4 text-xs text-gray-400 uppercase tracking-widest">
            Cenas tiek atjauninātas reāllaikā
          </p>
        </div>
      </div>
    </section>
  );
}
