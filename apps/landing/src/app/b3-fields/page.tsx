import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';
import { ArrowRight, MapPin, Package, Recycle, Truck, FileCheck, Clock } from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Package,
    title: 'Materiālu paņemšana',
    body: 'Nopērciet materiālu platformā un paņemiet to uz vietas ar savu auto vai traktoru. Ideāli māju saimniekiem un maziem pasūtījumiem, kur piegāde nav nepieciešama. Digitāls čeks — bez papīra.',
    tag: 'Pieejams visās vietās',
  },
  {
    icon: Recycle,
    title: 'Atkritumu nodošana',
    body: 'Iebrauciet ar kravas auto pilnu ar celtniecības atkritumiem. Platforma ģenerē juridiski derīgu atkritumu pārvietošanas sertifikātu uzreiz uz vietas — atbilstoši ES direktīvai bez papildu birokrātijas.',
    tag: 'Sertifikāts uzreiz',
  },
  {
    icon: Truck,
    title: 'Piekabe īrei',
    body: 'Maziem pasūtījumiem, kad liels kravas auto nav nepieciešams — iznomājiet piekabi uz vietas. Piesaistīta jūsu pasūtijumam platformā automātiski. Atgrieziet tajā pašā vietā vai citā B3 Field punktā.',
    tag: 'No €25 / dienā',
  },
];

const locations = [
  {
    city: 'Rīga',
    address: 'Maskavas iela 300, Rīga',
    services: ['Paņemšana', 'Atkritumi', 'Piekabe'],
  },
  {
    city: 'Jelgava',
    address: 'Rūpniecības iela 45, Jelgava',
    services: ['Paņemšana', 'Atkritumi'],
  },
  { city: 'Liepāja', address: 'Klaipēdas šoseja 12, Liepāja', services: ['Paņemšana', 'Piekabe'] },
  {
    city: 'Valmiera',
    address: 'Rīgas iela 78, Valmiera',
    services: ['Paņemšana', 'Atkritumi', 'Piekabe'],
  },
  { city: 'Jēkabpils', address: 'Brīvības iela 34, Jēkabpils', services: ['Paņemšana'] },
  {
    city: 'Daugavpils',
    address: 'Varoņu iela 9, Daugavpils',
    services: ['Paņemšana', 'Atkritumi'],
  },
];

export default function B3FieldsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <Container as="section" className="pt-40 pb-32">
          <div className="flex flex-col gap-8 max-w-4xl">
            <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              B3 Fields — fiziskais tīkls
            </span>
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.9]">
              Fiziski punkti.
              <br />
              Digitāli
              <br />
              darījumi.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl tracking-tight">
              B3 Fields ir loģistikas mezgli visā Latvijā — materiālu paņemšana, atkritumu nodošana
              ar sertifikātu un piekabju noma. Viss caur platformu. Viss ar dokumentiem.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                href="#locations"
                className="bg-foreground text-background px-10 py-5 rounded-xl text-lg font-medium hover:scale-105 transition-transform text-center"
              >
                Skatīt vietas
              </Link>
              <Link
                href={`${APP_URL}/register`}
                className="border border-border px-10 py-5 rounded-xl text-lg font-medium hover:border-foreground transition-colors text-center"
              >
                Reģistrēties
              </Link>
            </div>
          </div>
        </Container>

        {/* ── WHAT IS B3 FIELD ── */}
        <section className="w-full py-24 border-t border-border bg-foreground">
          <Container>
            <p className="text-sm font-bold tracking-widest uppercase text-background/40 mb-12">
              Kas ir B3 Field?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
              <h2 className="text-4xl md:text-5xl font-medium tracking-tighter text-background leading-tight">
                Ne katram pasūtijumam vajadzīga pilna piegāde. B3 Fields atrisina to.
              </h2>
              <div className="flex flex-col gap-6">
                <p className="text-lg text-background/60 font-light leading-relaxed">
                  Mazi pasūtijumi — vairākas tonnas smilts vai grants mājas projektam — bieži vien
                  piegādes izmaksas pārsniedz paša materiāla cenu. B3 Field ļauj jums paņemt
                  materiālu pašam, kad tas ir izdevīgāk.
                </p>
                <p className="text-lg text-background/60 font-light leading-relaxed">
                  Celtniecības atkritumu izvešana juridiskajā sistēmā prasa dokumentus. B3 Field
                  ģenerē tos automātiski uz vietas — bez birokrātijas, bez gaidīšanas.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* ── SERVICES ── */}
        <Container as="section" className="py-32 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Pakalpojumi
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {services.map(({ icon: Icon, title, body, tag }) => (
              <div key={title} className="bg-background p-10 flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <Icon className="w-8 h-8 text-foreground" strokeWidth={1.5} />
                  <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-medium tracking-tight mb-3">{title}</h3>
                  <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>

        {/* ── HOW TO USE ── */}
        <Container as="section" className="py-32 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kā izmantot B3 Field
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              {
                step: '01',
                title: 'Atver platformu',
                body: 'Reģistrējies vai ienāc B3Hub platformā. Izvēlies "B3 Field paņemšana" vai "Atkritumu nodošana".',
              },
              {
                step: '02',
                title: 'Izvēlies vietu & laiku',
                body: 'Atver karti ar visām B3 Field vietām. Izvēlies tuvāko un rezervē laiku —  atbraukšanas slots apstiprinās uzreiz.',
              },
              {
                step: '03',
                title: 'Iebrauc un saņem dokumentu',
                body: 'Uz vietas skenē QR kodu pie ieejas. Darījums tiek apstrādāts automātiski — saņem dokumentu telefonā.',
              },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="md:px-12 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-6"
              >
                <span className="text-5xl font-medium tracking-tighter text-border">{step}</span>
                <h3 className="text-2xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── LOCATIONS ── */}
        <Container as="section" id="locations" className="py-32 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Vietas
              </p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter">
                6 punkti Latvijā.
              </h2>
            </div>
            <p className="text-lg text-muted-foreground font-light max-w-sm md:text-right">
              Tīkls aug — jaunas vietas 2026. gadā Igaunijā un Lietuvā.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border border-t border-b border-border">
            {locations.map(({ city, address, services: svc }) => (
              <div
                key={city}
                className="flex flex-col md:flex-row md:items-center justify-between py-7 gap-4 group hover:bg-muted/20 -mx-4 px-4 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <MapPin
                    className="w-5 h-5 text-muted-foreground flex-shrink-0"
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="text-xl font-medium tracking-tight">{city}</p>
                    <p className="text-muted-foreground font-light text-sm mt-0.5">{address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  {svc.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-bold tracking-widest uppercase bg-muted text-muted-foreground px-3 py-1.5 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>

        {/* ── OPENING HOURS ── */}
        <section className="w-full py-24 border-t border-border bg-muted/20">
          <Container className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/3">
              <Clock className="w-8 h-8 text-foreground mb-6" strokeWidth={1.5} />
              <h2 className="text-3xl font-medium tracking-tight mb-4">Darba laiks</h2>
              <p className="text-muted-foreground font-light">
                Dalibas apmeklēšana notiek pēc rezervācijas.
              </p>
            </div>
            <div className="md:w-2/3 flex flex-col divide-y divide-border border-t border-b border-border w-full">
              {[
                { day: 'Pirmdiena – Piektdiena', time: '07:00 – 19:00' },
                { day: 'Sestdiena', time: '08:00 – 16:00' },
                { day: 'Svētdiena', time: 'Slēgts' },
                { day: 'Svētku dienas', time: 'Skatīt platformā' },
              ].map(({ day, time }) => (
                <div key={day} className="flex items-center justify-between py-5">
                  <p className="text-base font-light">{day}</p>
                  <p className="text-base font-medium">{time}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-[0.95]">
              Atrodi tuvāko
              <br />
              B3 Field.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <Link
                href={`${APP_URL}/register`}
                className="bg-background text-foreground px-10 py-5 rounded-xl text-xl font-medium hover:scale-105 transition-transform text-center"
              >
                Reģistrēties bez maksas
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
