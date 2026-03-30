import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  ArrowRight,
  Truck,
  HardHat,
  Pickaxe,
  FileCheck,
  MapPin,
  Users,
  BarChart3,
  Package,
  Recycle,
  ClipboardList,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const features = [
  {
    icon: FileCheck,
    title: 'Automātiski dokumenti',
    body: 'Svara zīme, CMR un rēķins tiek ģenerēti uzreiz pēc piegādes. Visi dokumenti pieejami mākonī — bez drukāšanas, skenēšanas vai e-pasta nosūtīšanas.',
  },
  {
    icon: MapPin,
    title: 'GPS izsekošana reāllaikā',
    body: 'Pasūtītājs redz kravas auto atrašanās vietu kartē no iekraušanas brīža. Bez zvaniem dispečeram — viss redzams telefonā.',
  },
  {
    icon: Package,
    title: 'Skip hire & konteineri',
    body: 'Pasūti atkritumu konteineru uz būvlaukumu vienā klikšķī. Platforma automātiski ieplāno atvešanu un aizvešanu, ģenerē aktu.',
  },
  {
    icon: Recycle,
    title: 'Atkritumu izvešana & sertifikāti',
    body: 'Celtniecības atkritumu izvešana ar juridiski derīgu atkritumu pārvietošanas sertifikātu. Atbilstība ES atkritumu direktīvai bez papildu darba.',
  },
  {
    icon: ClipboardList,
    title: 'Projektu izmaksu pārsekošana',
    body: 'Katrs pasūtījums tiek automātiski piesaistīts projektam. Reāllaika budžeta pārskats: plāns vs. fakts, iztērētais pa materiālu veidiem.',
  },
  {
    icon: Users,
    title: 'Uzņēmuma konts & komanda',
    body: 'Pievienojiet vairākus darbiniekus ar dažādām lomām — menedžeris, šoferis, grāmatvedis. Katram savs piekļuves līmenis.',
  },
  {
    icon: BarChart3,
    title: 'Ietvarlīgumi & iepirkumi',
    body: 'Lieliem būvuzņēmumiem: ietvarlīgumus ar fiksētām cenām. Atslēgdarbi (call-off) ar vienu klikšķi — transports ieplānots automātiski.',
  },
  {
    icon: Smartphone,
    title: 'Mobilā aplikācija šoferiem',
    body: 'Šoferis saņem maršrutu telefonā, ar navigāciju, dokumentu skenēšanu un digitālu parakstu pie piegādes. Bez papīra.',
  },
];

const materials = [
  { name: 'Šķembas & grants', desc: 'Frakcijas 0/4 – 32/64 mm' },
  { name: 'Smilts', desc: 'Uzbēruma, mazgāta, smalka' },
  { name: 'Dolomīts', desc: 'Ceļu un pamatu bērtne' },
  { name: 'Augsne & kūdra', desc: 'Labiekārtošanai un apzaļumošanai' },
  { name: 'Betons & reciklāts', desc: 'Smalcināts betons demontāžas pārstrādei' },
  { name: 'Asfalts', desc: 'Asfalta bērtne ceļu remontam' },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <section className="relative w-full pt-32 pb-24 md:pt-48 md:pb-32 px-6 lg:px-12 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="z-10 w-full md:w-1/2 flex flex-col gap-8">
            <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Celtniecības loģistika · Latvija & Baltija
            </span>
            <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-foreground leading-[0.9]">
              Pasūti.
              <br />
              Piegādā.
              <br />
              Dokumentē.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-md tracking-tight">
              B3Hub savieno būvniekus, grants karjerus un kravas auto vienā digitālā platformā — no
              pasūtījuma līdz parakstītam piegādes aktam.
            </p>
            <div className="bg-card border border-border rounded-xl shadow-sm p-2 flex flex-col md:flex-row w-full max-w-md gap-2">
              <Link
                href={`${APP_URL}/register`}
                className="flex-1 bg-primary text-primary-foreground text-center py-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Sākt bez maksas
              </Link>
              <Link
                href={`${APP_URL}/register?role=driver`}
                className="flex-1 bg-secondary text-secondary-foreground text-center py-4 rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Kļūt par šoferi
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2 h-[400px] md:h-[600px] bg-muted rounded-3xl overflow-hidden relative border border-border">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888086925-920a0b4111eb?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center" />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kā tas strādā
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              {
                step: '01',
                title: 'Pievieno pasūtījumu',
                body: 'Izvēlies materiālu no kataloga, norādi piegādes vietu un daudzumu. Cenas redzamas uzreiz — bez zvaniem vai e-pastiem.',
              },
              {
                step: '02',
                title: 'Karjers apstiprina & šoferis brauc',
                body: 'Piegādātājs apstiprina iekraušanu. Tuvākais brīvais šoferis saņem maršrutu. GPS izsekošana reāllaikā abām pusēm.',
              },
              {
                step: '03',
                title: 'Piegāde & automātiskie dokumenti',
                body: 'Pēc piegādes platforma ģenerē svara zīmi, CMR un rēķinu. Visi dokumenti arhīvā — juridiski derīgi, pieejami 5 gadus.',
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
        </section>

        {/* ── AUDIENCE BENTO ── */}
        <section className="w-full py-24 px-6 lg:px-12 max-w-7xl mx-auto">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kas izmanto B3Hub
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border p-10 rounded-3xl flex flex-col justify-between h-[400px] group hover:border-foreground/20 transition-all">
              <HardHat className="w-10 h-10 text-foreground" />
              <div>
                <h3 className="text-3xl font-medium tracking-tight mb-3">Būvnieki & Pasūtītāji</h3>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                  Pasūti materiālus un atkritumu izvešanu vienā ekrānā. Reāllaika izsekošana,
                  automātiskie akti un rēķini bez manuāla darba.
                </p>
                <Link
                  href="/buvniekiem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase hover:gap-3 gap-2 transition-all"
                >
                  Uzzināt vairāk <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="bg-foreground text-background p-10 rounded-3xl flex flex-col justify-between h-[400px] group">
              <Truck className="w-10 h-10 text-background/60" />
              <div>
                <h3 className="text-3xl font-medium tracking-tight mb-3">Šoferi & Pārvadātāji</h3>
                <p className="text-base mb-6 leading-relaxed text-background/60">
                  Saņem maršrutus tieši telefonā. Pārskats par paveiktajiem reisiem, izpeļņu un
                  dokumentiem — bez papīriem un zvaniem dispečeram.
                </p>
                <Link
                  href="/parvadatajiem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase text-background hover:gap-3 gap-2 transition-all"
                >
                  Sākt braukt <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="bg-card border border-border p-10 rounded-3xl flex flex-col justify-between h-[400px] group hover:border-foreground/20 transition-all">
              <Pickaxe className="w-10 h-10 text-foreground" />
              <div>
                <h3 className="text-3xl font-medium tracking-tight mb-3">Karjeri & Piegādātāji</h3>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                  Saņem pasūtījumus automātiski. Nav jātērē laiks telefoniem — klients atrod tevi
                  katalogā un cena ir noteikta iepriekš.
                </p>
                <Link
                  href="/karjeriem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase hover:gap-3 gap-2 transition-all"
                >
                  Pievienoties tīklam <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── PLATFORM FEATURES ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Platformas iespējas
              </p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tighter">
                Viss vienā vietā.
              </h2>
            </div>
            <p className="text-lg text-muted-foreground font-light max-w-sm md:text-right">
              Nevajadzīgi vairs žonglēt ar Excel failiem, WhatsApp grupām, papīra aktiem un bankas
              pārskaitījumiem.
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

        {/* ── MATERIALS CATALOG ── */}
        <section className="w-full py-32 border-t border-border px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/3 flex flex-col gap-6 md:sticky md:top-32">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Ko var pasūtīt
              </p>
              <h2 className="text-5xl font-medium tracking-tighter leading-tight">
                Materiālu katalogs.
              </h2>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Visi materiāli ar fiksētām cenām no verificētiem Latvijas karjeriem. Piegāde uz
                jebkuru adresi vai savākšana B3 Field punktā.
              </p>
              <Link
                href={`${APP_URL}/catalog`}
                className="flex items-center text-sm font-bold tracking-wide uppercase gap-2 hover:gap-4 transition-all mt-4"
              >
                Atvērt katalogu <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="md:w-2/3 flex flex-col divide-y divide-border border-t border-b border-border w-full">
              {materials.map(({ name, desc }) => (
                <div
                  key={name}
                  className="flex items-center justify-between py-6 group hover:bg-muted/30 -mx-4 px-4 transition-colors"
                >
                  <div>
                    <p className="text-xl font-medium tracking-tight">{name}</p>
                    <p className="text-muted-foreground font-light mt-1">{desc}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── B3 FIELDS ── */}
        <section className="w-full py-32 bg-foreground">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-16 items-start">
              <div className="md:w-1/2 flex flex-col gap-8">
                <p className="text-sm font-bold tracking-widest uppercase text-background/40">
                  B3 Fields — fiziskais tīkls
                </p>
                <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-[0.95]">
                  Fiziski punkti. Digitāli darījumi.
                </h2>
                <p className="text-xl text-background/60 font-light leading-relaxed max-w-md">
                  B3 Fields ir mūsu fiziskās loģistikas mezgli visā Latvijā. Materiālu paņemšana
                  pašam, atkritumu nodošana un piekabe īrei — viss caur platformu, viss ar
                  dokumentiem.
                </p>
              </div>
              <div className="md:w-1/2 grid grid-cols-1 gap-px bg-background/10">
                {[
                  {
                    title: 'Materiālu paņemšana',
                    body: 'Nopērc platformā, paņem uz vietas ar savu auto vai traktoru. Ideāli māju saimniekiem un maziem pasūtījumiem.',
                  },
                  {
                    title: 'Atkritumu nodošana',
                    body: 'Iebrauc ar kravas auto. Platforma ģenerē atkritumu pārvietošanas sertifikātu uzreiz uz vietas.',
                  },
                  {
                    title: 'Piekabe īrei',
                    body: 'Maza pasūtījuma gadījumā nepieciešama piekabe? Iznomā uz vietas, piesaistīta pasūtījumam platformā.',
                  },
                ].map(({ title, body }) => (
                  <div
                    key={title}
                    className="bg-foreground p-8 flex flex-col gap-3 border-b border-background/10 last:border-0"
                  >
                    <h3 className="text-xl font-medium text-background">{title}</h3>
                    <p className="text-background/50 font-light leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="w-full py-24 px-6 lg:px-12 max-w-7xl mx-auto border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x divide-border">
            {[
              { value: '1.5M+', label: 'Pārvietotās tonnas' },
              { value: '240+', label: 'Aktīvie transportlīdzekļi' },
              { value: '48h', label: 'Vidējais pirmā pasūtījuma laiks' },
            ].map(({ value, label }) => (
              <div key={label} className="md:px-16 first:pl-0 last:pr-0">
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

        {/* ── FINAL CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-[0.95]">
              Gatavs sākt
              <br />
              strādāt gudrāk?
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
