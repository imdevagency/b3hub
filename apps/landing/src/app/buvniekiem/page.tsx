import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
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

const painPoints = [
  'Zvanāt karjeriem, lai noskaidrotu cenu un pieejamību',
  'Sekot līdzi piegādēm ar WhatsApp ziņām',
  'Manuāli aizpildīt CMR un svara zīmes',
  'Zaudēt papīra dokumentus pirms rēķina apmaksas',
  'Nezināt, kurā brīdī šoferis ieradīsies',
  'Katru mēnesi samierināties ar pārsteiguma rēķiniem',
];

const features = [
  {
    icon: MapPin,
    title: 'GPS izsekošana reāllaikā',
    body: 'Redziet kravas auto atrašanās vietu no iekraušanas brīža. Precīzs ierašanās laiks — bez zvaniem dispečeram.',
  },
  {
    icon: FileCheck,
    title: 'Automātiski dokumenti',
    body: 'Pēc katras piegādes platforma uzreiz ģenerē svara zīmi, CMR un rēķinu. Viss arhīvā mākonī — 5 gadus.',
  },
  {
    icon: ClipboardList,
    title: 'Projektu pārsekošana',
    body: 'Katrs pasūtījums tiek piesaistīts projektam. Reāllaika budžeta pārskats: plānots vs. faktiski iztērēts.',
  },
  {
    icon: BarChart3,
    title: 'Ietvarlīgumi',
    body: 'Noslēdziet ietvarlīgumu ar fiksētām cenām. Katrs atslēgdarbs (call-off) ar vienu klikšķi — transports ieplānots automātiski.',
  },
  {
    icon: Users,
    title: 'Uzņēmuma konts',
    body: 'Darbinieki ar dažādām lomām — menedžeris, grāmatvedis, būvlaukuma vadītājs. Katram savs piekļuves līmenis.',
  },
  {
    icon: Package,
    title: 'Skip hire & konteineri',
    body: 'Pasūtiet atkritumu konteineru uz būvlaukumu. Platforma automātiski ieplāno atvešanu, aizvešanu un ģenerē aktu.',
  },
  {
    icon: Recycle,
    title: 'Atkritumu izvešana',
    body: 'Juridiski derīgi atkritumu pārvietošanas sertifikāti pēc katras izvešanas. Atbilstība ES direktīvai bez papildu darba.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Reģistrējies bez maksas',
    body: 'Izveidojiet uzņēmuma kontu un pievienojiet komandas locekļus. Nav nepieciešama kredītkarte — sākt var 5 minūtēs.',
  },
  {
    step: '02',
    title: 'Izvēlies materiālu un vietu',
    body: 'Atveriet katalogu, izvēlieties materiālu, norādiet piegādes adresi un daudzumu. Cena redzama uzreiz.',
  },
  {
    step: '03',
    title: 'Sekojiet piegādei telefonā',
    body: 'GPS izsekošana no iekraušanas brīža. Saņemiet paziņojumu, kad šoferis ir klāt.',
  },
  {
    step: '04',
    title: 'Dokumenti gatavi uzreiz',
    body: 'Svara zīme, CMR un rēķins ir arhīvā mākonī uzreiz pēc piegādes. Lejupielādēt vai nosūtīt grāmatvedim — vienā klikšķī.',
  },
];

export default function BuvnieckiemPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <section className="w-full pt-40 pb-32 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col gap-8 max-w-4xl">
            <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Būvniekiem & Pasūtītājiem
            </span>
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.9]">
              Pasūti materiālus.
              <br />
              Bez zvaniem.
              <br />
              Bez papīriem.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl tracking-tight">
              B3Hub automātiski savieno jūs ar tuvāko pieejamo krājumu un kravas auto — no
              pasūtījuma līdz parakstītam dokumentam vienā platformā.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                href={`${APP_URL}/register`}
                className="bg-foreground text-background px-10 py-5 rounded-xl text-lg font-medium hover:scale-105 transition-transform text-center"
              >
                Sākt bez maksas
              </Link>
              <Link
                href="/pricing"
                className="border border-border px-10 py-5 rounded-xl text-lg font-medium hover:border-foreground transition-colors text-center"
              >
                Skatīt cenas
              </Link>
            </div>
          </div>
        </section>

        {/* ── PAIN POINTS ── */}
        <section className="w-full py-24 border-t border-border bg-muted/30">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Vai tas jums ir pazīstami?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {painPoints.map((point) => (
                <div key={point} className="bg-background p-8 flex items-start gap-4">
                  <span className="text-2xl mt-0.5 select-none">😤</span>
                  <p className="text-base font-light text-muted-foreground leading-relaxed">
                    {point}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-2xl md:text-3xl font-medium tracking-tight mt-12 max-w-2xl">
              B3Hub atrisina visu to vienā platformā — nekādu zvanu, nekādu papīru.
            </p>
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

        {/* ── FEATURES ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Funkcijas
              </p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter">
                Viss, kas vajadzīgs.
              </h2>
            </div>
            <p className="text-lg text-muted-foreground font-light max-w-sm md:text-right">
              No vienkāršiem pasūtījumiem līdz sarežģītiem ietvarlīgumiem ar daudziem piegādātājiem.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
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

        {/* ── TRUST ── */}
        <section className="w-full py-24 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              { value: '1.5M+', label: 'Pārvietotās tonnas' },
              { value: '98%', label: 'Pasūtījumu izpildes rādītājs' },
              { value: '4.8★', label: 'Vidējais pasūtītāju vērtējums' },
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
        </section>

        {/* ── INCLUDED ── */}
        <section className="w-full py-24 border-t border-border bg-muted/20">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Iekļauts katrā pasūtījumā
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              {[
                'Reāllaika GPS izsekošana',
                'Automātiska svara zīme',
                'CMR pārvadājuma dokuments',
                'Elektroniski rēķins',
                'Piegādes paziņojumi',
                'Dokumentu arhīvs 5 gadus',
                'Projektu budžeta pārskats',
                'Prioritāra klientu atbalsts',
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
              Gatavs pasūtīt
              <br />
              pirmo kravas?
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <Link
                href={`${APP_URL}/register`}
                className="bg-background text-foreground px-10 py-5 rounded-xl text-xl font-medium hover:scale-105 transition-transform text-center"
              >
                Reģistrēties bez maksas
              </Link>
              <p className="text-center text-background/40 text-sm">Nav nepieciešama kredītkarte</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
