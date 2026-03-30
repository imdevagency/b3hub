import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Par mums',
  description:
    'B3Hub ir celtniecības loģistikas platforma, kas savieno pircējus, piegādātājus un pārvadātājus Latvijā un Baltijā.',
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Par B3Hub
            </h1>
            <p className="mt-6 text-xl leading-8 text-gray-600">
              Mēs veidojam celtniecības loģistikas platformu, kas dara biznesa procesus ātrākus,
              caurspīdīgākus un vienkāršākus visiem tirgus dalībniekiem.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-24 sm:py-32 bg-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Mūsu misija</h2>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Latvijas un Baltijas celtniecības nozare joprojām paļaujas uz telefona zvaniem,
                  papīra dokumentiem un neefektīviem procesiem. B3Hub maina to — digitalizējot visu
                  piegādes ķēdi no pasūtījuma līdz piegādei.
                </p>
                <p className="mt-4 text-lg leading-8 text-gray-600">
                  Mūsu platforma savieno pircējus, materiālu piegādātājus un transporta uzņēmumus
                  vienā ekosistēmā ar reāllaika izsekošanu, automātiskiem dokumentiem un ērtiem
                  norēķiniem.
                </p>
              </div>
              <div className="space-y-6">
                {[
                  { title: 'Dibināts', value: '2024' },
                  { title: 'Tirgus', value: 'Latvija & Baltija' },
                  { title: 'Fokuss', value: 'Celtniecības loģistika' },
                ].map((item) => (
                  <div key={item.title} className="border-l-4 border-primary pl-6">
                    <p className="text-sm font-medium text-gray-500">{item.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 text-center mb-16">
              Mūsu vērtības
            </h2>
            <dl className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                {
                  name: 'Caurspīdīgums',
                  description:
                    'Katrs darījums ir izsekojams un dokumentēts. Nav slēpto maksu vai pārpratumu.',
                },
                {
                  name: 'Efektivitāte',
                  description:
                    'Samazinām administratīvo slogu, automatizējot dokumentus, rēķinus un statusu paziņojumus.',
                },
                {
                  name: 'Uzticamība',
                  description:
                    'Veidojam ilgtermiņa attiecības starp tirgus dalībniekiem, balstoties uz vērtēšanas un atsauksmju sistēmu.',
                },
              ].map((v) => (
                <div
                  key={v.name}
                  className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                >
                  <dt className="text-lg font-bold text-primary mb-3">{v.name}</dt>
                  <dd className="text-gray-600">{v.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
