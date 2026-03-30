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
        <Container as="section" className="pt-48 pb-32 md:pt-56 md:pb-40">
          <div className="flex flex-col gap-10 max-w-5xl">
            <h1 className="text-7xl md:text-[8rem] font-bold tracking-tighter text-foreground leading-[0.85]">
              Fiziski punkti.
              <br />
              Digitāli darījumi.
            </h1>
            <p className="text-2xl text-muted-foreground font-light max-w-2xl tracking-tight">
              Aizmirsti par birokrātiju. Paņem materiālus, nodod atkritumus un īrē piekabes ar pāris
              klikšķiem savā telefonā.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link
                href={`${APP_URL}/register`}
                className="bg-foreground text-background px-10 py-5 text-lg font-medium hover:bg-foreground/90 transition-colors text-center flex items-center justify-center gap-2"
              >
                Sākt lietot <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#locations"
                className="bg-muted text-foreground px-10 py-5 text-lg font-medium hover:bg-muted/80 transition-colors text-center"
              >
                Skatīt vietas
              </Link>
            </div>
          </div>
        </Container>

        {/* ── WHAT IS B3 FIELD ── */}
        <section className="w-full py-40 bg-foreground text-background">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-start">
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter leading-tight">
                Gudra loģistika,
                <br /> bez liekas gaidīšanas.
              </h2>
              <div className="flex flex-col gap-8">
                <p className="text-xl text-background/70 font-light leading-relaxed">
                  Mazi pasūtijumi — vairākas tonnas smilts vai grants mājas projektam — bieži vien
                  piegādes izmaksas pārsniedz paša materiāla cenu. B3 Field ļauj jums paņemt
                  materiālu pašam, kad tas ir izdevīgāk.
                </p>
                <p className="text-xl text-background/70 font-light leading-relaxed">
                  Celtniecības atkritumu izvešana juridiskajā sistēmā prasa dokumentus. B3 Field
                  ģenerē tos automātiski uz vietas — bez birokrātijas, bez gaidīšanas.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* ── SERVICES ── */}
        <Container as="section" className="py-40">
          <h2 className="text-4xl font-medium tracking-tighter mb-20">Pakalpojumi.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {services.map(({ icon: Icon, title, body, tag }) => (
              <div key={title} className="flex flex-col gap-6">
                <div className="bg-muted w-16 h-16 flex items-center justify-center rounded-none mb-4">
                  <Icon className="w-8 h-8 text-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-3xl font-medium tracking-tight mb-4">{title}</h3>
                  <p className="text-muted-foreground text-lg font-light leading-relaxed mb-6">
                    {body}
                  </p>
                  <span className="text-sm font-medium tracking-wide text-foreground border border-border px-4 py-2 rounded-none">
                    {tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Container>

        {/* ── HOW TO USE ── */}
        <section className="w-full py-40 bg-muted/30">
          <Container>
            <h2 className="text-4xl font-medium tracking-tighter mb-20">Kā tas strādā.</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24">
              {[
                {
                  step: '01',
                  title: 'Atver platformu',
                  body: 'Reģistrējies vai ienāc platformā. Izvēlies pakalpojumu.',
                },
                {
                  step: '02',
                  title: 'Izvēlies vietu',
                  body: 'Atrodi tuvāko punktu un rezervē ierašanās laiku bez rindas.',
                },
                {
                  step: '03',
                  title: 'Skenē un brauc',
                  body: 'Uz vietas skenē QR kodu. Darījums un dokumenti apstrādājas automātiski.',
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex flex-col gap-6 border-t-2 border-foreground pt-8">
                  <span className="text-2xl font-bold tracking-tighter text-foreground">
                    {step}
                  </span>
                  <h3 className="text-3xl font-medium tracking-tight">{title}</h3>
                  <p className="text-muted-foreground text-lg font-light leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── LOCATIONS ── */}
        <Container as="section" id="locations" className="py-40">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <h2 className="text-6xl md:text-8xl font-medium tracking-tighter">B3 Tīkls.</h2>
            <p className="text-xl text-muted-foreground font-light max-w-sm md:text-right">
              Mēs nepārtraukti augam. Jaunas vietas gaidāmas 2026. gadā.
            </p>
          </div>
          <div className="flex flex-col">
            {locations.map(({ city, address, services: svc }) => (
              <div
                key={city}
                className="flex flex-col md:flex-row md:items-center justify-between py-10 gap-4 border-b border-border group hover:pl-4 transition-all"
              >
                <div className="flex items-center gap-8">
                  <h3 className="text-4xl font-medium tracking-tight w-48">{city}</h3>
                  <p className="text-muted-foreground text-xl font-light">{address}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap md:justify-end">
                  {svc.map((s) => (
                    <span
                      key={s}
                      className="text-sm font-medium tracking-wide bg-muted text-foreground px-4 py-2"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>

        {/* ── CTA ── */}
        <section className="w-full py-40 bg-foreground">
          <Container className="flex flex-col items-center justify-center text-center gap-12">
            <h2 className="text-5xl md:text-[6rem] font-bold tracking-tighter text-background leading-[0.9]">
              Sāc jau šodien.
            </h2>
            <div className="flex flex-col gap-6 mt-8">
              <Link
                href={`${APP_URL}/register`}
                className="bg-background text-foreground px-12 py-6 text-xl font-medium hover:bg-background/90 transition-colors"
              >
                Izveidot bezmaksas kontu
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
