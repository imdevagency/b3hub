import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

export function CTA() {
  return (
    <section className="bg-white border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-32 sm:py-40 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tighter text-black sm:text-6xl">
            Sākt tagad.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-500">
            Reģistrējieties platformā minūtes laikā. Piesakiet piegādi vai atklājiet jaunus
            pasūtījumus jau šodien.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`${APP_URL}/register`}
              className="w-full sm:w-auto bg-black px-8 py-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Reģistrēties tagad
            </Link>
            <Link
              href={`${APP_URL}/apply`}
              className="w-full sm:w-auto border border-gray-300 bg-white px-8 py-4 text-sm font-medium text-black hover:border-black hover:bg-gray-50 transition-colors"
            >
              Kļūt par piegādātāju
            </Link>
          </div>
          <div className="mt-8">
            <Link
              href={`${APP_URL}/login`}
              className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
            >
              Jau ir konts? Ieiet <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
