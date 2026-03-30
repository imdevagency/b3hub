import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  ArrowRight,
  Smartphone,
  MapPin,
  FileCheck,
  Banknote,
  Shield,
  Clock,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const steps = [
  {
    step: '01',
    title: 'Lejupielādē aplikāciju',
    body: 'Reģistrējies kā šoferis vai pievienojies esošam pārvadātāju uzņēmumam. Verificācija notiek 24h laikā.',
  },
  {
    step: '02',
    title: 'Saņem maršrutu',
    body: 'Tiklīdz parādās piemērojams kravas uzdevums, saņem paziņojumu. Pieņem vai noraidīt — tava izvēle.',
  },
  {
    step: '03',
    title: 'Braukā ar navigāciju',
    body: 'Iebūvēta navigācija uz iekraušanas un izkraušanas vietu. Iekraušanas apstiprinājums ar QR kodu vai fotogrāfiju.',
  },
  {
    step: '04',
    title: 'Digitālais paraksts & samaksa',
    body: 'Saņem klienta digitālo parakstu uz telefona. Dokuments gatavs uzreiz. Samaksa — automātiski pēc katras piegādes.',
  },
];

const features = [
  {
    icon: Smartphone,
    title: 'Viss vienā lietotnē',
    body: 'Maršruts, navigācija, dokumenti, izpeļņas pārskats un saziņa — viss vienā lietotnē. Bez papīra, bez zvaniem dispečeram.',
  },
  {
    icon: MapPin,
    title: 'Integrēta navigācija',
    body: 'Maršruts uz iekraušanu un izkraušanu ar precīzām GPS koordinātēm. Vienmēr zini, uz kurieni doties.',
  },
  {
    icon: FileCheck,
    title: 'Dokumenti uz telefona',
    body: 'Svara zīme un CMR tiek ģenerēti automātiski. Saņem klienta parakstu uz ekrāna — bez papīra.',
  },
  {
    icon: Banknote,
    title: 'Automātiskā samaksa',
    body: 'Izpeļņa tiek aprēķināta pēc katras piegādes un pārskaitīta uz jūsu kontu. Nekādu kavētu rēķinu vai neskaidrību.',
  },
  {
    icon: Clock,
    title: 'Elastīgs grafiks',
    body: 'Strādājiet, kad ērti. Nav minimālā stundu skaita — pieņemiet darbus atbilstoši savai pieejamībai.',
  },
  {
    icon: Shield,
    title: 'Apdrošināšana & atbalsts',
    body: 'Katrs reiss ir apdrošināts. Ja rodas problēma, B3Hub atbalsta komanda ir pieejama visu diennakti.',
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
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <section className="w-full pt-40 pb-32 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col gap-8 max-w-4xl">
            <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Šoferiem & Pārvadātājiem
            </span>
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.9]">
              Braukā.
              <br />
              Pelni.
              <br />
              Bez papīriem.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl tracking-tight">
              Saņemiet kravas maršrutus tieši telefonā. Dokumenti automātiski. Samaksa — uzreiz pēc
              piegādes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                href={`${APP_URL}/register?role=driver`}
                className="bg-foreground text-background px-10 py-5 rounded-xl text-lg font-medium hover:scale-105 transition-transform text-center"
              >
                Kļūt par šoferi
              </Link>
              <Link
                href="#earnings"
                className="border border-border px-10 py-5 rounded-xl text-lg font-medium hover:border-foreground transition-colors text-center"
              >
                Skatīt izpeļņu
              </Link>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kā tas strādā
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
            {steps.map(({ step, title, body }) => (
              <div key={step} className="bg-background p-8 flex flex-col gap-5">
                <span className="text-4xl font-medium tracking-tighter text-border">{step}</span>
                <h3 className="text-xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── EARNINGS ── */}
        <section id="earnings" className="w-full py-32 border-t border-border bg-foreground">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
              <div>
                <p className="text-sm font-bold tracking-widest uppercase text-background/40 mb-4">
                  Izpeļņa
                </p>
                <h2 className="text-5xl md:text-6xl font-medium tracking-tighter text-background leading-tight">
                  Cik var nopelnīt?
                </h2>
              </div>
              <p className="text-lg text-background/50 font-light max-w-sm md:text-right">
                Indikatīvas likmes Latvijā. Atkarīgs no reģiona, sezonas un kravas veida.
              </p>
            </div>
            <div className="flex flex-col divide-y divide-background/10 border-t border-b border-background/10">
              {earnings.map(({ type, rate }) => (
                <div key={type} className="flex items-center justify-between py-7 group">
                  <p className="text-xl font-light text-background">{type}</p>
                  <p className="text-2xl font-medium tracking-tight text-background">{rate}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-background/40 mt-6 font-light">
              * Pievienojoties ar savu automašīnu. Pārvadātāju uzņēmumiem — sazinieties ar mums par
              uzņēmuma tarifiem.
            </p>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Aplikācija
              </p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter">Viss telefonā.</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-background p-8 flex flex-col gap-5">
                <Icon className="w-8 h-8 text-foreground" strokeWidth={1.5} />
                <div>
                  <h3 className="text-lg font-medium tracking-tight mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm font-light leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── REQUIREMENTS ── */}
        <section className="w-full py-24 border-t border-border bg-muted/20">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Prasības pievienošanai
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              {[
                'Latvijā reģistrēts kravas auto (vai traktors)',
                'Derīga vadītāja apliecība (C kategorija)',
                'Transportlīdzekļa apdrošināšana (OCTA / KASKO)',
                'Latvijas vai ES rezidents',
                'Tīrs kriminālais rekorods',
                'Viedtālrunis ar Android vai iOS',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle
                    className="w-5 h-5 text-foreground flex-shrink-0"
                    strokeWidth={1.5}
                  />
                  <span className="text-base font-light">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-[0.95]">
              Sāc braukt
              <br />
              jau šonedēļ.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <Link
                href={`${APP_URL}/register?role=driver`}
                className="bg-background text-foreground px-10 py-5 rounded-xl text-xl font-medium hover:scale-105 transition-transform text-center"
              >
                Reģistrēties kā šoferis
              </Link>
              <p className="text-center text-background/40 text-sm">Verificācija 24h laikā</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
