import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';
import { CTAButton } from '@/components/ui/cta-button';
import {
  ArrowRight,
  MapPin,
  FileText,
  Package,
  FolderKanban,
  CreditCard,
  Truck,
  Check,
} from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const features = [
  {
    icon: MapPin,
    slug: 'gps-izsekosana',
    eyebrow: 'Izsekošana',
    title: 'Reāllaika GPS — katrā brīdī',
    body: 'Seko katram auto no iekraušanas līdz objektam. Paziņojumi, precīzs ierašanās laiks un pilns piegādes žurnāls — bez WhatsApp zvaniem.',
    stat: { value: '< 30s', label: 'atjauninājumu biežums' },
    bullets: ['Dzīvā pozīcija kartē', 'Push paziņojumi', 'Pilns žurnāls'],
    mock: 'gps',
  },
  {
    icon: FileText,
    slug: 'dokumenti',
    eyebrow: 'Dokumenti',
    title: 'Automātiski dokumenti pēc piegādes',
    body: 'Svara zīme, CMR un rēķins tiek ģenerēti automātiski brīdī, kad šoferis apstiprina piegādi. Juridiskā spēkā, 5 gadus arhīvā.',
    stat: { value: '0', label: 'pazaudētu dokumentu' },
    bullets: ['Digitāla svara zīme', 'CMR ģenerācija', 'Automātiskie rēķini'],
    mock: 'docs',
  },
  {
    icon: Package,
    slug: 'katalogs',
    eyebrow: 'Katalogs',
    title: 'Materiāli ar cenu uzreiz — bez zvaniem',
    body: 'Pasūti granītu, granti, smiltis vai citus materiālus tieši no kataloga. Cenas, pieejamība un piegādes datums redzami pirms pasūtīšanas.',
    stat: { value: '240+', label: 'aktīvi piegādātāji' },
    bullets: ['Reālās cenas no karjeriem', 'Pieejamības kalkulators', 'Ātrā pasūtīšana'],
    mock: 'catalog',
  },
  {
    icon: FolderKanban,
    slug: 'projekti',
    eyebrow: 'Projektu vadība',
    title: 'Vairāki projekti, viens pārskats',
    body: 'Izseko pasūtījumus pa projektiem. Ietvara līgumi, izsaukumi un apjomi — strukturēti vienā vietā katrai būvvietai.',
    stat: { value: '∞', label: 'aktīvi projekti bez piemaksas' },
    bullets: ['Ietvara līgumi', 'Izsaukumu kontrole', 'Apjomu kopsavilkums'],
    mock: 'projects',
  },
  {
    icon: CreditCard,
    slug: 'maksajumi',
    eyebrow: 'Rēķini & Maksājumi',
    title: 'Viens rēķins par visu mēnesi',
    body: 'Visi piegādātāji, viens strukturēts rēķins. Šoferi saņem izmaksu nākamajā dienā. Nav manuālo tabulu, nav kavētu maksājumu.',
    stat: { value: '1 darba diena', label: 'šoferu izmaksa' },
    bullets: ['Konsolidēti rēķini', 'Automātiskā samaksa', 'ERP eksports'],
    mock: 'billing',
  },
  {
    icon: Truck,
    slug: 'dispets',
    eyebrow: 'Šoferu dispečerizācija',
    title: 'Darbi tieši telefonā — bez dispečera',
    body: 'Šoferis saņem maršrutu, kravas datus un norādījumus tieši lietotnē. Pieņem vai atgriez darbu ar vienu pieskārienu.',
    stat: { value: '< 2 min', label: 'laiks līdz darba pieņemšanai' },
    bullets: ['Push paziņojumi', 'Maršruts + navigācija', 'Digitālie pavadraksti'],
    mock: 'dispatch',
  },
];

function GpsMock() {
  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <span className="font-mono text-xs text-muted-foreground tracking-widest">B3-2847</span>
        <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground inline-block animate-pulse" />
          Aktīvs
        </span>
      </div>
      <div className="flex-1 relative bg-muted/20 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-foreground rounded-full flex items-center justify-center text-background text-xs font-bold shadow-lg shadow-foreground/20 animate-pulse">
            AK
          </div>
          <div className="bg-background border border-border px-3 py-1.5 text-xs font-medium shadow-sm">
            ~18 min
          </div>
        </div>
      </div>
      <div className="px-5 py-3.5 border-t border-border">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Granīts karjers</span>
          <span>Rīga, A. Kalniņa 12</span>
        </div>
        <div className="relative w-full h-px bg-border">
          <div className="absolute top-0 left-0 h-px bg-foreground w-2/3" />
          <div className="absolute top-1/2 left-2/3 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-foreground border-2 border-background" />
        </div>
      </div>
    </div>
  );
}

function DocsMock() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-6 text-sm">
      {[
        { label: 'Svara zīme', id: 'SVZ-0284', done: true },
        { label: 'CMR pavadzīme', id: 'CMR-1192', done: true },
        { label: 'Rēķins', id: 'RK-2026-084', done: true },
        { label: 'Piegādes akts', id: 'PA-0912', done: false },
      ].map(({ label, id, done }) => (
        <div
          key={id}
          className={`flex items-center justify-between border px-4 py-3 ${
            done ? 'border-foreground/30 bg-muted/20' : 'border-border opacity-40'
          }`}
        >
          <div>
            <p className="font-medium text-xs">{label}</p>
            <p className="font-mono text-xs text-muted-foreground">{id}</p>
          </div>
          {done && <Check className="w-4 h-4 text-foreground" strokeWidth={2.5} />}
        </div>
      ))}
    </div>
  );
}

function CatalogMock() {
  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="h-7 w-full bg-border/40 rounded-sm flex items-center px-3">
          <span className="text-xs text-muted-foreground">Granīta šķembas 20–40…</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-border overflow-hidden">
        {[
          { name: 'Granīta šķembas 20–40', supplier: 'Liepa SIA', price: '€9.50/t', dist: '12 km' },
          { name: 'Smilts 0–4', supplier: 'Granīts SIA', price: '€7.20/t', dist: '8 km' },
          { name: 'Dolomīta grants', supplier: 'Akmenssala', price: '€6.80/t', dist: '24 km' },
        ].map(({ name, supplier, price, dist }) => (
          <div key={name} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="font-medium text-xs leading-tight">{name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {supplier} · {dist}
              </p>
            </div>
            <span className="font-bold text-xs shrink-0">{price}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3.5 border-t border-border">
        <div className="h-8 bg-foreground flex items-center justify-center">
          <span className="text-xs font-bold tracking-wide uppercase text-background">Pasūtīt</span>
        </div>
      </div>
    </div>
  );
}

function ProjectsMock() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-6 text-sm">
      <div className="border border-foreground/30 p-4 flex flex-col gap-2 bg-muted/20">
        <div className="flex justify-between items-start">
          <p className="font-bold text-xs">Bytona iela 14 — Rīga</p>
          <span className="text-xs font-mono text-muted-foreground">ILG-014</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>5 izsaukumi</span>
          <span>284 t piegādāts</span>
        </div>
        <div className="relative w-full h-px bg-border mt-1">
          <div className="absolute top-0 left-0 h-px bg-foreground w-4/5" />
        </div>
        <p className="text-xs text-muted-foreground">80% no ieplānotā apjoma</p>
      </div>
      {[
        { name: 'Juglas tilts — būvdarbi', calls: 3, tons: 120 },
        { name: 'Mežciems dzīvokļi', calls: 1, tons: 42 },
      ].map(({ name, calls, tons }) => (
        <div key={name} className="border border-border px-4 py-3 flex justify-between text-xs">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">
            {calls} iz. · {tons} t
          </span>
        </div>
      ))}
    </div>
  );
}

function BillingMock() {
  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="font-bold text-xs tracking-tight">Rēķins RK-2026-084</span>
        <span className="text-xs font-mono text-muted-foreground">Apr 2026</span>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-border">
        {[
          { label: 'Granīts karjers – 4 piegādes', amount: '€1 240' },
          { label: 'Smilts & Grants – 2 piegādes', amount: '€620' },
          { label: 'Transporta komisija', amount: '€148' },
        ].map(({ label, amount }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5 text-xs">
            <span className="text-muted-foreground max-w-[60%] leading-snug">{label}</span>
            <span className="font-bold">{amount}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 border-t border-foreground/30 bg-muted/20 flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wide">Kopā</span>
        <span className="text-xl font-bold tracking-tight">€2 008</span>
      </div>
    </div>
  );
}

function DispatchMock() {
  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="font-bold text-xs">Jaunais darbs</span>
        <span className="text-xs text-muted-foreground">Šodien 14:32</span>
      </div>
      <div className="flex-1 flex flex-col gap-4 p-5">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Materiāls</p>
          <p className="font-bold">Granīta šķembas 20–40 · 22 t</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Iekraušana</p>
            <p className="font-medium text-xs">Karjers "Liepa"</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Piegāde</p>
            <p className="font-medium text-xs">A. Kalniņa 12, Rīga</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Maršruts</p>
          <p className="font-medium text-xs">38 km · ~48 min</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-0 border-t border-border">
        <button className="py-3.5 text-xs font-bold tracking-wide uppercase border-r border-border text-muted-foreground hover:bg-muted/30 transition-colors">
          Atteikt
        </button>
        <button className="py-3.5 text-xs font-bold tracking-wide uppercase bg-foreground text-background">
          Pieņemt
        </button>
      </div>
    </div>
  );
}

const mockMap: Record<string, React.FC> = {
  gps: GpsMock,
  docs: DocsMock,
  catalog: CatalogMock,
  projects: ProjectsMock,
  billing: BillingMock,
  dispatch: DispatchMock,
};

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <section className="pt-40 pb-24 md:pt-48 md:pb-32 border-b border-border">
          <Container>
            <div className="flex flex-col gap-10 max-w-3xl">
              <div className="flex items-center gap-4">
                <div className="h-0.5 w-12 bg-foreground" />
                <span className="text-sm font-bold tracking-widest uppercase">Platforma</span>
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-[5rem] font-bold tracking-tighter leading-[0.95]">
                Viss vienā
                <br />
                platformā.
              </h1>
              <p className="text-xl text-muted-foreground font-light max-w-xl leading-relaxed">
                B3Hub digitalizē katru soli — no materiālu kataloga līdz automātiskajiem
                dokumentiem. Seši moduļi, kas strādā kopā nevainojami.
              </p>
              <div className="flex flex-wrap gap-4">
                <CTAButton href={`${APP_URL}/register`} variant="primary" size="lg">
                  Izmēģināt bez maksas
                </CTAButton>
                <CTAButton href="/pricing" variant="secondary" size="lg">
                  Skatīt cenas
                </CTAButton>
              </div>
            </div>
          </Container>
        </section>

        {/* ── FEATURE GRID ── */}
        <Container as="section" className="py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, slug, eyebrow, title, body, stat, bullets, mock }) => {
              const Mock = mockMap[mock];
              return (
                <div
                  key={slug}
                  className="flex flex-col group border border-border shadow-sm hover:shadow-md transition-shadow bg-background"
                >
                  {/* Mock UI */}
                  <div className="border-b border-border h-64 overflow-hidden bg-muted/10 relative">
                    <Mock />
                  </div>

                  {/* Content */}
                  <div className="flex flex-col gap-4 p-8 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                        {eyebrow}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight leading-tight">{title}</h2>
                    <p className="text-muted-foreground font-light text-sm leading-relaxed">
                      {body}
                    </p>

                    <ul className="flex flex-col gap-1.5 mt-1">
                      {bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Check
                            className="w-3.5 h-3.5 shrink-0 text-foreground"
                            strokeWidth={2.5}
                          />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-4 border-t border-border flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold tracking-tighter">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                      <Link
                        href={`/features/${slug}`}
                        className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase group-hover:gap-2.5 transition-all"
                      >
                        Uzzināt vairāk <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>

        {/* ── COMPARE SECTION ── */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Vecā metode vs B3Hub
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-border">
              <div className="flex flex-col gap-4 md:pr-16 pb-12 md:pb-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Pirms B3Hub
                </p>
                {[
                  'Zvani karjeriem, lai noskaidrotu cenas',
                  'WhatsApp grupas, lai sekotu piegādei',
                  'Papīra svara zīmes un CMR',
                  'Rēķini no 10 dažādiem piegādātājiem',
                  'Excel, lai apkopotu projektus',
                  'Dispečera zvans katram šoferim',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                    <span className="font-light">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4 md:pl-16 pt-12 md:pt-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Ar B3Hub
                </p>
                {[
                  'Cenas katalogā — uzreiz un caurspīdīgi',
                  'Reāllaika GPS lietotnē ar paziņojumiem',
                  'Dokumenti ģenerējas automātiski',
                  'Viens konsolidēts rēķins mēnesī',
                  'Projekti ar apjomu kontroli platformā',
                  'Darbi tiek nosūtīti šoferim automātiski',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-foreground" strokeWidth={2.5} />
                    <span className="font-light">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-background leading-none">
              Gatavs izmēģināt
              <br />
              pilnu platformu?
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`${APP_URL}/register`} variant="inverted" size="lg">
                Sākt bez maksas
              </CTAButton>
              <p className="text-center text-background/40 text-sm">Nav nepieciešama kredītkarte</p>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
