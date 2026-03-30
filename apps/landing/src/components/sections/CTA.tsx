import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

export function CTA() {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Gatavs sākt?</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-foreground/80">
            Pasūtiet materiālus kā pircējs vai pieteicieties kā piegādātājs vai pārvadātājs.
            Platforma bez komisijas maksas pirmajā mēnesī.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`${APP_URL}/register`}
              className="rounded-md bg-white px-6 py-3 text-base font-semibold text-primary shadow-sm hover:bg-primary/5 transition-colors"
            >
              Reģistrēties kā pircējs
            </Link>
            <Link
              href={`${APP_URL}/apply`}
              className="rounded-md border-2 border-white/60 px-6 py-3 text-base font-semibold text-white hover:border-white hover:bg-white/10 transition-colors"
            >
              Kļūt par piegādātāju
            </Link>
            <Link
              href={`${APP_URL}/login`}
              className="text-base font-semibold leading-7 text-red-100 hover:text-white transition-colors"
            >
              Jau ir konts? Ieiet <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
