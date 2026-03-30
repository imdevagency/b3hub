import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const steps = [
  {
    step: '01',
    title: 'Saņem',
    body: 'Tiklīdz parādās piemērojams kravas uzdevums, saņem paziņojumu. Pieņem vai noraidi.',
  },
  {
    step: '02',
    title: 'Brauc',
    body: 'Iebūvēta navigācija uz iekraušanas un izkraušanas vietu. Viss redzams vienā ekrānā.',
  },
  {
    step: '03',
    title: 'Pelni',
    body: 'Saņem klienta digitālo parakstu uz telefona. Izpeļņa tiek aprēķināta automātiski.',
  },
];

const features = [
  {
    title: 'Viss vienā lietotnē',
    body: 'Maršruts, navigācija, dokumenti, izpeļņas pārskats un saziņa — viss vienā ekrānā. Bez papīriem un bez zvaniem dispečeram.',
  },
  {
    title: 'Automātiska samaksa',
    body: 'Izpeļņa tiek aprēķināta pēc katras piegādes un pārskaitīta uz jūsu kontu. Nekādu kavētu rēķinu vai neskaidrību.',
  },
  {
    title: 'Elastīgs grafiks',
    body: 'Strādājiet, kad ērti. Nav minimālā stundu skaita — pieņemiet darbus un rekrutējiet šoferus atbilstoši savam grafikam.',
  },
  {
    title: 'Dokumenti uz telefona',
    body: 'Svara zīme un CMR tiek ģenerēti automātiski. Saņem klienta parakstu uz ekrāna un turpiniet ceļu uz nākamo pasūtījumu.',
  },
];

const earnings = [
  { type: 'Vietējais reiss (< 50 km)', rate: '€85–€140 / reiss' },
  { type: 'Reģionālais reiss (50–150 km)', rate: '€160–€280 / reiss' },
  { type: 'Skip hire piegāde', rate: '€65–€95 / piegāde' },
  { type: 'Bulk nedēļa (5+ reisi)', rate: 'Bonuss līdz €200' },
];

export default function ParvadatajemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background flex flex-col pt-24">
      <Navbar />
      <main className="flex-1 w-full flex flex-col">
        {/* HERO */}
        <Container as="section" className="py-32 md:py-48 flex flex-col items-start">
          <div className="md:w-4/5 flex flex-col">
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter leading-none mb-12">
              Brauc.
              <br />
              Pelni.
              <br />
              Bez papīriem.
            </h1>
            <p className="text-2xl md:text-3xl font-light tracking-tight max-w-xl text-muted-foreground mb-16">
              Saņemiet kravas maršrutus tieši telefonā. Dokumenti automātiski. Samaksa uzreiz.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link
                href={`${APP_URL}/register?role=carrier`}
                className="bg-foreground text-background text-xl py-6 px-12 rounded-full font-medium tracking-tight text-center hover:bg-foreground/90 transition-colors"
                style={{ alignSelf: 'flex-start' }}
              >
                Kļūt par šoferi
              </Link>
            </div>
          </div>
        </Container>

        <hr className="border-t border-border" />

        {/* HOW IT WORKS (STEPS) */}
        <Container as="section" className="py-32 md:py-48 flex flex-col">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-24 max-w-2xl">
            Viss process vienā aplikācijā.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col border-t border-border pt-8">
                <span className="text-6xl md:text-8xl tracking-tighter font-medium text-muted-foreground/30 mb-8">
                  {s.step}
                </span>
                <h3 className="text-2xl font-medium tracking-tight mb-4">{s.title}</h3>
                <p className="text-lg font-light text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* EARNINGS */}
        <section className="w-full bg-[#0a0a0a] text-white">
          <Container className="py-32 md:py-48 flex flex-col">
            <div className="flex flex-col md:flex-row border-b border-white/20 pb-24 gap-16 md:gap-0">
              <div className="md:w-1/2">
                <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none">
                  Izpeļņa.
                </h2>
              </div>
              <div className="md:w-1/2 flex flex-col text-lg md:text-2xl font-light tracking-tight text-white/70">
                <p>Indikatīvas likmes Latvijā. Atkarīgs no reģiona, sezonas un kravas veida.</p>
              </div>
            </div>
            <div className="flex flex-col mt-16">
              {earnings.map((e, i) => (
                <div
                  key={i}
                  className="flex flex-col md:flex-row justify-between py-8 md:py-12 border-b border-white/10 text-2xl md:text-4xl tracking-tight font-light"
                >
                  <span className="mb-4 md:mb-0 text-white/60">{e.type}</span>
                  <span>{e.rate}</span>
                </div>
              ))}
            </div>
            <p className="text-white/40 mt-16 text-sm font-light uppercase tracking-widest">
              * Pievienojoties ar savu automašīnu. Pārvadātāju uzņēmumiem — sazinieties ar mums.
            </p>
          </Container>
        </section>

        {/* FEATURES */}
        <Container as="section" className="py-32 md:py-48 flex flex-col">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-24 max-w-2xl">
            Kāpēc pārvadāt ar <br /> B3Hub?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-16">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col border-t border-border pt-8">
                <h3 className="text-3xl font-medium tracking-tight mb-4">{f.title}</h3>
                <p className="text-xl font-light text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* REQUIREMENTS AND CTA */}
        <section className="w-full bg-foreground text-background">
          <Container className="py-32 md:py-48 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <div className="flex flex-col">
                <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-16">Prasības</h2>
                <ul className="flex flex-col space-y-8 text-2xl font-light tracking-tight text-background/80">
                  <li className="flex gap-6 items-center">
                    <span className="w-2 rounded-full h-2 bg-background/50"></span>
                    Latvijā reģistrēts kravas auto (vai traktors)
                  </li>
                  <li className="flex gap-6 items-center">
                    <span className="w-2 rounded-full h-2 bg-background/50"></span>
                    Derīga vadītāja apliecība (C / CE kategorija)
                  </li>
                  <li className="flex gap-6 items-center">
                    <span className="w-2 rounded-full h-2 bg-background/50"></span>
                    Transportlīdzekļa apdrošināšana (OCTA)
                  </li>
                  <li className="flex gap-6 items-center">
                    <span className="w-2 rounded-full h-2 bg-background/50"></span>
                    Viedtālrunis ar Android vai iOS
                  </li>
                </ul>
              </div>

              <div className="flex flex-col items-start justify-center">
                <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none mb-12">
                  Sāc <br /> braukt.
                </h2>
                <Link
                  href={`${APP_URL}/register?role=carrier`}
                  className="bg-background text-foreground text-xl py-6 px-12 rounded-full font-medium tracking-tight hover:bg-background/90 transition-colors"
                >
                  Izveidot profilu
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </div>
  );
}
