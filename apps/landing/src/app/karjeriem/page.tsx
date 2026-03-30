import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';
import {
  ArrowRight,
  FileCheck,
  BarChart3,
  Users,
  ShoppingCart,
  Bell,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const steps = [
  {
    step: '01',
    title: 'Reģistrē uzņēmumu',
    body: 'Pievienojiet karjera vai piegādātāja profilu. Norādiet pieejamos materiālus, frakcijas un cenas. Verificācija notiek 48h laikā.',
  },
  {
    step: '02',
    title: 'Parādies katalogā',
    body: 'Jūsu materiāli ir redzami visiem B3Hub pasūtītājiem Latvijā. Klients arod jūs patstāvīgi — bez reklāmas.',
  },
  {
    step: '03',
    title: 'Saņem pasūtījumu & apstiprina iekraušanu',
    body: 'Saņemiet paziņojumu par jaunu pasūtījumu. Apstipriniet iekraušanas laiku — šoferis saņem maršrutu automātiski.',
  },
  {
    step: '04',
    title: 'Dokumenti & samaksa automātiski',
    body: 'Pēc piegādes platforma ģenerē rēķinu un svara zīmi. Samaksa no pasūtītāja — automātiski, bez atgādinājumiem.',
  },
];

const features = [
  {
    icon: ShoppingCart,
    title: 'Pasūtījumi bez zvaniem',
    body: 'Klienti atrod jūs katalogā un pasūta tiešsaistē. Nav jāatbild uz zvaniem ar cenu jautājumiem.',
  },
  {
    icon: Bell,
    title: 'Reāllaika paziņojumi',
    body: 'Saņemiet push paziņojumu par katru jaunu pasūtījumu uzreiz. Apstiprināt vai noraidīt — 2 klikšķi.',
  },
  {
    icon: FileCheck,
    title: 'Automātiski dokumenti',
    body: 'Svara zīmes un rēķini tiek ģenerēti automātiski pēc katras piegādes. Viss arhīvā mākonī.',
  },
  {
    icon: BarChart3,
    title: 'Pārdošanas analītika',
    body: 'Redziet, cik tonnu pārdots, kāda ir vidējā cena un kuri materiāli ir vispopulārākie. Plānojiet krājumu gudri.',
  },
  {
    icon: Users,
    title: 'Ietvarlīgumi',
    body: 'Noslēdziet ilgtermiņa līgumus ar lieliem būvuzņēmumiem. Stabils pasūtījumu plūsma visu sezonu.',
  },
  {
    icon: CheckCircle,
    title: 'Pārvaldīta cenu noteikšana',
    body: 'Jūs nosakāt cenu par tonnu. Platforma automātiski aprēķina piegādes izmaksas un rāda gala cenu klientam.',
  },
];

const materials = [
  'Šķembas & grants (frakcijas 0/4 – 32/64 mm)',
  'Smilts (uzbēruma, mazgāta, smalka)',
  'Dolomīts (ceļu un pamatu bērtne)',
  'Augsne & kūdra (labiekārtošanai)',
  'Betons & reciklāts (smalcināts betons)',
  'Asfalts (bērtne ceļu remontam)',
  'Mālsmilts & māls',
  'Laukakmeņi & bruģakmens',
];

export default function KarjeriemPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <Container as="section" className="pt-40 pb-32">
          <div className="flex flex-col gap-8 max-w-4xl">
            <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Karjeriem & Piegādātājiem
            </span>
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.9]">
              Vairāk pasūtījumu.
              <br />
              Bez zvaniem.
              <br />
              Bez papīriem.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl tracking-tight">
              Ievietojiet savus materiālus B3Hub katalogā — pasūtītāji no visas Latvijas var atrast
              jūs patstāvīgi un pasūtīt tiešsaistē.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                href={`${APP_URL}/register?role=seller`}
                className="bg-foreground text-background px-10 py-5 rounded-xl text-lg font-medium hover:scale-105 transition-transform text-center"
              >
                Pievienot karjeru
              </Link>
              <Link
                href="/contact"
                className="border border-border px-10 py-5 rounded-xl text-lg font-medium hover:border-foreground transition-colors text-center"
              >
                Runāt ar pārdošanu
              </Link>
            </div>
          </div>
        </Container>

        {/* ── PROBLEM ── */}
        <section className="w-full py-24 border-t border-border bg-muted/30">
          <Container className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/2">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-8">
                Problēma
              </p>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight mb-6">
                Karjeri vairāk laika tērē zvaniem nekā pārdošanai.
              </h2>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Klienti zvana, lai noskaidrotu cenu. Vēlreiz zvana, lai pārbaudītu pieejamību. Jums
                jāraksta rēķini manuāli. Dokumenti tiek sūtīti pa e-pastu. Samaksa kavējas. B3Hub
                automātiski apstrādā visu — no pasūtijuma līdz samaksai.
              </p>
            </div>
            <div className="md:w-1/2 flex flex-col divide-y divide-border border-t border-b border-border w-full">
              {[
                { before: 'Zvani ar cenu jautājumiem', after: 'Klients redz cenu katalogā' },
                { before: 'Manuāla brīvdienu koordinācija', after: 'Pasūtijums ierodas pats' },
                { before: 'Papīra svara zīmes', after: 'Automātiska svara zīme' },
                { before: 'Kavēti rēķini', after: 'Samaksa automātiski pēc piegādes' },
              ].map(({ before, after }) => (
                <div key={before} className="py-5 grid grid-cols-2 gap-4">
                  <p className="text-muted-foreground font-light line-through text-sm">{before}</p>
                  <p className="text-foreground font-medium text-sm">{after}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── HOW IT WORKS ── */}
        <Container as="section" className="py-32 border-t border-border">
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
        </Container>

        {/* ── FEATURES ── */}
        <Container as="section" className="py-32 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Funkcijas
              </p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter">Pilna kontrole.</h2>
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
        </Container>

        {/* ── MATERIALS ── */}
        <Container as="section" className="py-32 border-t border-border">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/3 flex flex-col gap-6 md:sticky md:top-32">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Katalogā pieejamie materiāli
              </p>
              <h2 className="text-5xl font-medium tracking-tighter leading-tight">
                Ko var pārdot?
              </h2>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Ja jums ir kāds no šiem materiāliem, varat pievienoties katalogam šodien. Ja nē —
                sazinieties ar mums.
              </p>
            </div>
            <div className="md:w-2/3 flex flex-col divide-y divide-border border-t border-b border-border w-full">
              {materials.map((mat) => (
                <div
                  key={mat}
                  className="flex items-center justify-between py-6 group hover:bg-muted/30 -mx-4 px-4 transition-colors"
                >
                  <p className="text-lg font-light">{mat}</p>
                  <CheckCircle
                    className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    strokeWidth={1.5}
                  />
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── STATS ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              { value: '240+', label: 'Aktīvie pārvadātāji platformā' },
              { value: '18', label: 'Reģistrētie piegādātāji' },
              { value: '1.5M+', label: 'Pārvietotās tonnas' },
            ].map(({ value, label }) => (
              <div key={label} className="md:px-16 first:pl-0 last:pr-0 py-8 md:py-0">
                <p className="text-7xl md:text-8xl font-medium tracking-tighter leading-none">
                  {value}
                </p>
                <p className="text-xl text-muted-foreground mt-4 font-light tracking-tight">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-[0.95]">
              Pievienojies
              <br />
              tīklam šodien.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <Link
                href={`${APP_URL}/register?role=seller`}
                className="bg-background text-foreground px-10 py-5 rounded-xl text-xl font-medium hover:scale-105 transition-transform text-center"
              >
                Reģistrēt karjeru
              </Link>
              <Link
                href="/contact"
                className="text-center text-background/40 text-sm hover:text-background/70 transition-colors"
              >
                Vai sazinieties ar mums →
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
