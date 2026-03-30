import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-6 py-32 sm:py-48 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tighter text-black sm:text-7xl">
            Order. Move. Document.
          </h1>
          <p className="mt-8 text-lg text-gray-500 max-w-2xl mx-auto">
            The infrastructure layer for Baltic construction logistics. Connect suppliers,
            contractors and carriers in one transaction flow.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`${APP_URL}/register`}
              className="w-full sm:w-auto bg-black px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Atvērt platformu →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
