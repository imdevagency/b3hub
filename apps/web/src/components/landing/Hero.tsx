import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-red-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Sakārtojiet Savus Materiālu Pasūtījumus ar <span className="text-red-600">B3Hub</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Savienojiet piegādātājus, klientus un vadītājus vienā jaudīgā platformā. Pārvaldiet
            materiālus, izsekojiet pasūtījumiem un optimizējiet piegādes ķēdi ar ērtumu.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
            >
              Sākt bez maksas →
            </Link>
            <Link
              href="/apply"
              className="rounded-md border-2 border-gray-300 px-6 py-3 text-base font-semibold text-gray-900 hover:border-red-500 hover:text-red-600 transition-colors"
            >
              Kļūt par piegādātāju
            </Link>
            <Link
              href="#how-it-works"
              className="text-base font-semibold leading-7 text-gray-900 hover:text-red-600 transition-colors"
            >
              Kā tas darbojas <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
