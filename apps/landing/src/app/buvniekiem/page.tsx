import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';
import {
  ArrowRight,
  FileCheck,
  MapPin,
  ClipboardList,
  Users,
  BarChart3,
  Package,
  Recycle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const problems = [
  { old: 'Zvani karjeriem un šoferiem', new: 'Cenas un pieejamība uzreiz' },
  { old: 'Piegādes sekosana WhatsApp', new: 'Reāllaika GPS izsekošana' },
  { old: 'Papīra svara zīmes un CMR', new: 'Visi dokumenti ģenerēti automātiski' },
  { old: 'Rēķini no 10 dažādiem piegādātājiem', new: 'Viss pārskatāms vienā projektā' },
];

const features = [
  {
    title: 'Izsekošana un precizitāte',
    body: 'Sekojiet līdzi kravas auto reāllaikā no iekraušanas līdz jūsu būvlaukumam. Precīzs ierašanās laiks un paziņojumi telefonā.',
  },
  {
    title: 'Automātiski dokumenti',
    body: 'Pēc katras piegādes saņemiet digitāli parakstītu svara zīmi un CMR. Visi dokumenti glabājas mākoņa arhīvā 5 gadus.',
  },
  {
    title: 'Atkritumu izvešana',
    body: 'Pasūtiet būvgružu izvešanu un uzreiz saņemiet atkritumu pārvietošanas sertifikātu, nodrošinot pilnu atbilstību ES prasībām.',
  },
  {
    title: 'Projektu budžetēšana',
    body: 'Katrs pasūtījums automātiski piesaistās konkrētam projektam, sniedzot caurspīdīgu pārskatu par izmaksām un budžeta izpildi.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Izvēlies',
    body: 'Atrodi materiālu vai pakalpojumu katalogā. Cena ir zināma pirms pasūtījuma.',
  },
  {
    step: '02',
    title: 'Izseko',
    body: 'Redzi kravas auto tuvojoties. Saņem paziņojumu, kad piegāde ir klāt.',
  },
  {
    step: '03',
    title: 'Saņem',
    body: 'Visi nepieciešamie dokumenti ir sagatavoti automātiski un pieejami platformā.',
  },
];

export default function BuvnieckiemPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <Container
          as="section"
          className="pt-48 pb-32 flex flex-col md:flex-row items-center justify-between gap-16"
        >
          <div className="flex flex-col gap-10 w-full md:w-3/5">
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.85]">
              Pasūti.
              <br />
              Seko.
              <br />
              Strādā.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-lg tracking-tight">
              Aizmirsti par zvanīšanu karjeriem un pazudušām svara zīmēm. Uzreiz zināmas cenas,
              reāllaika piegāde un automātiski dokumenti.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 mt-4">
              <Link
                href={`${APP_URL}/register`}
                className="bg-foreground text-background px-10 py-5 text-xl font-medium hover:scale-[1.02] transition-transform text-center"
              >
                Sākt bez maksas
              </Link>
            </div>
          </div>
          <div className="w-full md:w-2/5 aspect-square bg-[#0a0a0a] flex items-center justify-center p-12">
            <p className="text-background/50 font-light text-2xl tracking-tighter">
              B3Hub / Būvniekiem
            </p>
          </div>
        </Container>

        {/* ── PROBLEM (BEFORE VS AFTER) ── */}
        <Container as="section" className="py-32 border-t border-border">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-medium tracking-tighter leading-tight mb-6">
                Zvani, WhatsApp un Excel ir pagātne.
              </h2>
            </div>
            <div className="md:w-1/2 flex flex-col divide-y divide-border border-t border-b border-border w-full">
              {problems.map(({ old, new: after }) => (
                <div key={old} className="py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="text-muted-foreground font-light line-through decoration-1 text-lg">
                    {old}
                  </p>
                  <p className="text-foreground font-medium text-lg flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" /> {after}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── HOW IT WORKS ── */}
        <section className="w-full py-32 bg-[#0a0a0a] text-background">
          <Container>
            <p className="text-sm font-bold tracking-widest uppercase text-background/40 mb-24">
              Kā tas strādā
            </p>
            <div className="flex flex-col divide-y divide-background/20 border-t border-b border-background/20">
              {steps.map(({ step, title, body }) => (
                <div
                  key={step}
                  className="flex flex-col md:flex-row md:items-center gap-6 md:gap-16 py-12"
                >
                  <span className="text-6xl md:text-8xl font-medium tracking-tighter text-background/20 md:w-32">
                    {step}
                  </span>
                  <div className="flex-1 md:flex md:items-center md:gap-12 md:justify-between">
                    <h3 className="text-3xl md:text-5xl font-medium tracking-tighter mb-4 md:mb-0 w-full md:w-1/3">
                      {title}
                    </h3>
                    <p className="text-background/60 font-light text-xl leading-relaxed max-w-lg w-full md:w-2/3">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── FEATURES ── */}
        <Container as="section" className="py-32">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Funkcijas
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-y-24">
            {features.map(({ title, body }) => (
              <div key={title} className="flex flex-col gap-4 border-t border-border pt-6">
                <h3 className="text-3xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground text-xl font-light leading-relaxed max-w-md">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── STATS ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-16">
            {[
              { value: '1.5M+', label: 'Tonnas pārvietotas' },
              { value: '98%', label: 'Piegādes laikā' },
              { value: '0', label: 'Zaudēti dokumenti' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-8xl font-medium tracking-tighter leading-none">{value}</p>
                <p className="text-xl text-muted-foreground mt-4 font-light tracking-tight">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── CTA ── */}
        <Container
          as="section"
          className="py-32 border-t border-border flex flex-col items-center justify-center text-center gap-12"
        >
          <h2 className="text-6xl md:text-8xl font-medium tracking-tighter leading-[0.9]">
            Aizmirsti par papīriem.
          </h2>
          <Link
            href={`${APP_URL}/register`}
            className="bg-foreground text-background px-12 py-6 text-xl font-medium hover:scale-[1.02] transition-transform flex items-center gap-4"
          >
            Izveidot kontu <ArrowRight className="w-6 h-6" />
          </Link>
        </Container>
      </main>
      <Footer />
    </>
  );
}
