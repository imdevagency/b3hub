import Link from "next/link";

export function CTA() {
  return (
    <section className="bg-red-600">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-red-100">
            Join B3Hub today and transform the way you manage materials and orders. 
            Available on web and mobile platforms.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/register"
              className="rounded-md bg-white px-6 py-3 text-base font-semibold text-red-600 shadow-sm hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="text-base font-semibold leading-7 text-white hover:text-red-100 transition-colors"
            >
              Sign in <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
