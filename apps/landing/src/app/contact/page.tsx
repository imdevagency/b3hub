import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Kontakti',
  description: 'Sazinieties ar B3Hub komandu. Esam šeit, lai palīdzētu.',
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Sazinieties ar mums
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Vai jums ir jautājumi par platformu, partnerību vai tehnisks pieprasījums? Mūsu
                komanda ir gatava palīdzēt.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 max-w-5xl mx-auto">
              {/* Contact info */}
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">E-pasts</h3>
                    <p className="mt-1 text-gray-600">info@b3hub.lv</p>
                    <p className="text-sm text-gray-500">Atbildam 1 darba dienas laikā</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Telefons</h3>
                    <p className="mt-1 text-gray-600">+371 20 000 000</p>
                    <p className="text-sm text-gray-500">Darba dienās 9:00–18:00</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Adrese</h3>
                    <p className="mt-1 text-gray-600">Rīga, Latvija</p>
                  </div>
                </div>
              </div>

              {/* Contact form */}
              <form
                action="mailto:info@b3hub.lv"
                method="get"
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-6"
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Vārds, uzvārds
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Jānis Bērziņš"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    E-pasts
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="janis@piemers.lv"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Ziņojums
                  </label>
                  <textarea
                    id="message"
                    name="body"
                    rows={5}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Kā varam palīdzēt?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  Nosūtīt ziņojumu
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
