import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { ArrowRight, MapPin, Clock, Banknote, CheckCircle } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';


const earnings = [
  { type: 'Vietējais reiss (< 50 km)', rate: '€85–€140 / reiss' },
  { type: 'Reģionālais reiss (50–150 km)', rate: '€160–€280 / reiss' },
  { type: 'Skip hire piegāde', rate: '€65–€95 / piegāde' },
];

const journey = [
  {
    step: '01',
    title: 'Saņem darbu',
    body: 'Darbi parādās pēc atrašanās vietas un kravas veida. Pieņem vai noraidi — bez sekām.',
    features: ['Push paziņojums ar detaļām', 'Redzama izpeļņa pirms piekrišanas'],
  },
  {
    step: '02',
    title: 'Brauc',
    body: 'Lietotne parāda maršrutu uz iekraušanu un izkraušanu. Visi norādījumi vienā ekrānā.',
    features: ['Maršruts un navigācija ar vienu pieskārienu', 'Saziņāšanās ar pasūtītāju tieši'],
  },
  {
    step: '03',
    title: 'Pelni',
    body: 'Klienta paraksts uz ekrāna — piegāde apstiprināta. Nauda kontā nākamajā darba dienā.',
    features: ['CMR un svara zīme automātiski', 'Izmaksa D+1, minimums €10'],
  },
];

const requirements = [
  'Latvijā reģistrēts kravas auto (vai traktors)',
  'Derīga vadītāja apliecība (C / CE kategorija)',
  'Transportlīdzekļa apdrošināšana (OCTA)',
  'Viedtālrunis ar Android vai iOS',
];

export default function ParvadatajemPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground w-full overflow-clip">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Pārvadātājiem"
          title={
            <>
              Nākamais
              <br />
              reiss — jau
              <br />
              telefonā.
            </>
          }
          subtitle="Pieņem darbu, brauc, saņem samaksu. Bez dispečera zvaniem, bez papīra CMR, bez kavētiem rēķiniem."
          actions={
            <>
              <CTAButton href={`/register?role=carrier`} variant="primary" size="lg">
                Kļūt par šoferi
              </CTAButton>
            </>
          }
          pricingNote="Komisija 8%. Nav ikmēneša maksas."
        >
          {/* Right: mock job card */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                Jauns darbs
              </span>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 text-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                Gaida atbildi
              </span>
            </div>

            <div className="flex flex-col gap-6 p-8">
              {/* Material */}
              <div>
                <p className="text-2xl font-bold tracking-tight leading-none mb-2">
                  Atkritumu grants — 22 t
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  Karjers "Liepa" → Būvlaukums Rīgā
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-3 h-3" strokeWidth={1.5} />
                    <span className="text-xs uppercase tracking-widest">Attālums</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight">48 km</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    <span className="text-xs uppercase tracking-widest">Laiks</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight">~1h 45m</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Banknote className="w-3 h-3" strokeWidth={1.5} />
                    <span className="text-xs uppercase tracking-widest">Izpeļņa</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight">€122</p>
                </div>
              </div>

              {/* Action buttons (mocked) */}
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-6">
                <div className="border border-border py-3 text-center text-sm font-medium text-muted-foreground">
                  Noraidīt
                </div>
                <div className="bg-foreground text-background py-3 text-center text-sm font-medium">
                  Pieņemt darbu
                </div>
              </div>

              {/* Auto-doc note */}
              <div className="flex items-start gap-3 text-xs text-muted-foreground border border-border p-4">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>CMR un svara zīme tiks ģenerēti automātiski pēc izkraušanas.</span>
              </div>
            </div>
          </div>
        </Hero>

        {/* ── EARNINGS ── */}
        <section className="w-full bg-[#0a0a0a] text-white">
          <Container className="py-32 flex flex-col">
            <div className="flex flex-col md:flex-row gap-12 border-b border-white/20 pb-16 mb-8">
              <div className="md:w-1/2">
                <p className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">
                  Izpeļņa
                </p>
                <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none">
                  Reālas likmes.
                  <br />
                  Nekādu pārsteigumu.
                </h2>
              </div>
              <div className="md:w-1/2 flex items-end">
                <p className="text-lg font-light text-white/60 leading-relaxed">
                  Indikatīvas likmes Latvijā. Atkarīgs no reģiona, sezonas un kravas veida. Komisija
                  8% — nav citu maksu.
                </p>
              </div>
            </div>
            <div className="flex flex-col">
              {earnings.map((e) => (
                <div
                  key={e.type}
                  className="flex flex-col md:flex-row justify-between py-8 border-b border-white/10 md:items-center gap-2"
                >
                  <span className="text-xl md:text-2xl font-light tracking-tight text-white/60">
                    {e.type}
                  </span>
                  <span className="text-2xl md:text-4xl tracking-tighter font-medium">
                    {e.rate}
                  </span>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── BENTO FEATURES ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col gap-16">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mb-4">
                Mazāk papīra.
                <br />
                Vairāk ceļā.
              </h2>
              <p className="text-xl text-muted-foreground font-light">
                B3Hub apstrādā visu birokrātiju automātiski — tu koncentrējies uz braukšanu un
                peļņu.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[280px]">
              {/* Feature 1: Large Wide */}
              <div className="md:col-span-2 bg-muted/30 border border-border p-8 flex flex-col justify-between group overflow-hidden relative">
                <div className="z-10 max-w-sm">
                  <h3 className="text-2xl font-bold tracking-tight mb-2">
                    Automātiska dokumentācija
                  </h3>
                  <p className="text-muted-foreground font-light text-lg">
                    CMR un svara zīme tiek ģenerētas uzreiz pēc izkraušanas. Nav jāraksta nekas —
                    tikai jāparakstās uz ekrāna.
                  </p>
                </div>
                <div className="absolute -right-8 -bottom-8 w-72 h-64 bg-background border border-border rounded-2xl shadow-2xl skew-x-[-4deg] rotate-[4deg] transition-transform group-hover:rotate-0 group-hover:skew-x-0 duration-500 ease-out hidden md:flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      CMR Nr.
                    </p>
                    <p className="text-3xl font-black tracking-tighter">B3-2847</p>
                    <div className="w-16 h-px bg-border mx-auto my-3" />
                    <p className="text-xs text-muted-foreground font-light">Parakstīts · 14:32</p>
                  </div>
                </div>
              </div>

              {/* Feature 2: Small Square */}
              <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Banknote className="w-24 h-24" />
                </div>
                <h3 className="text-6xl font-black tracking-tighter mb-2 z-10 mt-auto">D+1</h3>
                <p className="text-muted-foreground font-light z-10">
                  Izmaksa nākamajā darba dienā. Nav jāgaida nedēļas.
                </p>
              </div>

              {/* Feature 3: Small Square */}
              <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center">
                <h3 className="text-6xl font-black tracking-tighter mb-2 mt-auto">8%</h3>
                <p className="text-muted-foreground font-light">
                  Komisija. Nav ikmēneša maksas, nav pievienošanās maksas.
                </p>
              </div>

              {/* Feature 4: Medium Wide */}
              <div className="md:col-span-2 bg-foreground text-background p-8 flex flex-col justify-between overflow-hidden relative">
                <div className="z-10 max-w-sm">
                  <h3 className="text-2xl font-bold tracking-tight mb-2">
                    Maršruta norādījumi lietotnē
                  </h3>
                  <p className="text-background/70 font-light text-lg">
                    Maršruts no karjera līdz objektam redzams lietotnē. Pasūtītājs redz tavu
                    atrašanās vietu reāllaikā — bez zvaniem.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 top-0 w-1/2 bg-linear-to-l from-background/20 to-transparent items-center justify-end pr-8 hidden md:flex">
                  <div className="w-48 h-32 bg-background/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl font-bold text-white tracking-widest uppercase">
                      GPS LIVE
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>

        {/* ── STICKY JOURNEY ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col md:flex-row gap-16 relative pb-32">
            {/* Left: Scrollable Text Steps */}
            <div className="md:w-1/2 flex flex-col gap-40 py-24">
              {journey.map((item) => (
                <div key={item.step} className="flex flex-col gap-5 pr-8">
                  <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground border-b border-border pb-4 w-12">
                    {item.step}
                  </span>
                  <h3 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight mt-2">
                    {item.title}
                  </h3>
                  <p className="text-xl text-muted-foreground font-light leading-relaxed">
                    {item.body}
                  </p>
                  <ul className="flex flex-col gap-3 mt-4 border-t border-border pt-6">
                    {item.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm font-light">
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Right: Sticky Phone Mockup */}
            <div className="md:w-1/2 relative hidden md:block">
              <div className="sticky top-32 w-full max-w-md mx-auto aspect-9/18 bg-muted/20 border border-border rounded-[3rem] p-4 flex flex-col gap-2 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-border rounded-b-2xl z-20" />

                {/* App header */}
                <div className="w-full h-14 mt-4 flex gap-3 items-center px-4">
                  <div className="w-8 h-8 rounded-full bg-foreground" />
                  <div className="h-3 w-32 bg-foreground/90 rounded-full" />
                </div>

                {/* Job card mock */}
                <div className="flex-1 flex flex-col gap-4 py-4 px-2 overflow-hidden relative">
                  <div className="w-full bg-background border border-border shadow-sm rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-base">Atkritumu grants — 22 t</p>
                        <p className="text-xs text-muted-foreground">Karjers → Rīga, 48 km</p>
                      </div>
                      <span className="text-lg font-black tracking-tight">€122</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Attālums</p>
                        <p className="font-bold text-sm">48 km</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Laiks</p>
                        <p className="font-bold text-sm">~1h 45m</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Krava</p>
                        <p className="font-bold text-sm">22 t</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="border border-border py-2 text-center text-xs font-medium text-muted-foreground rounded">
                        Noraidīt
                      </div>
                      <div className="bg-foreground text-background py-2 text-center text-xs font-medium rounded">
                        Pieņemt darbu
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-16 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4 opacity-50">
                    <div className="w-10 h-8 bg-muted rounded-lg" />
                    <div className="flex-1 flex flex-col gap-1.5 justify-center">
                      <div className="w-2/3 h-2 bg-muted-foreground rounded-full" />
                      <div className="w-1/3 h-2 bg-muted rounded-full" />
                    </div>
                    <p className="text-sm font-bold self-center">€98</p>
                  </div>
                  <div className="w-full h-16 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4 opacity-30">
                    <div className="w-10 h-8 bg-muted rounded-lg" />
                    <div className="flex-1 flex flex-col gap-1.5 justify-center">
                      <div className="w-1/2 h-2 bg-muted-foreground rounded-full" />
                      <div className="w-1/4 h-2 bg-muted rounded-full" />
                    </div>
                    <p className="text-sm font-bold self-center">€145</p>
                  </div>
                  {/* Gradient fade */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-muted/20 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </Container>

        {/* ── REQUIREMENTS ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-2/5 flex flex-col gap-4">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Prasības
              </p>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight">
                Vai tu vari pievienoties?
              </h2>
              <p className="text-muted-foreground font-light">
                Ja tev ir kravas auto un tālrunis — viss pārējais ir atrisināts.
              </p>
            </div>
            <div className="md:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border w-full">
              {requirements.map((r) => (
                <div key={r} className="bg-background p-8 flex items-start gap-4">
                  <CheckCircle
                    className="w-4 h-4 text-foreground shrink-0 mt-0.5"
                    strokeWidth={1.5}
                  />
                  <p className="text-base font-light">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── FAQ ── */}
        <Container as="section" className="py-32 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-16 md:mb-24">
            Biežāk uzdotie jautājumi
          </h2>
          <div className="flex flex-col">
            {(
              [
                {
                  q: 'Cik liela ir komisija?',
                  a: '8% no katras sekmīgas piegādes. Nav ikmēneša maksas, nav pievienošanās maksas.',
                },
                {
                  q: 'Kā notiek izmaksa?',
                  a: 'Izmaksa nākamajā darba dienā pēc piegādes apstiprināšanas. Minimālā summa €10.',
                },
                {
                  q: 'Vai man jāstrādā noteiktā reģionā?',
                  a: 'Nē. Jūs brīvi izvēlaties darbus visā Latvijā atbilstoši savai atrašanās vietai un maršrutam.',
                },
                {
                  q: 'Ko vajag reģistrācijai?',
                  a: 'Derīga vadītāja apliecība (C vai CE), OCTA apdrošināšana un viedtālrunis ar iOS vai Android.',
                },
              ] as { q: string; a: string }[]
            ).map(({ q, a }) => (
              <div
                key={q}
                className="flex flex-col md:flex-row gap-4 md:gap-12 py-10 border-t border-border"
              >
                <div className="md:w-1/2">
                  <h3 className="text-2xl font-medium tracking-tight">{q}</h3>
                </div>
                <div className="md:w-1/2">
                  <p className="text-muted-foreground font-light text-lg md:text-xl leading-relaxed">
                    {a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>

        {/* ── CTA ── */}
        <Container
          as="section"
          className="py-32 border-t border-border flex flex-col items-center justify-center text-center gap-8"
        >
          <h2 className="text-5xl md:text-6xl font-bold tracking-tighter leading-none">
            Nākamais reiss — tavs.
          </h2>
          <p className="text-muted-foreground font-light text-lg">
            Reģistrācija bez maksas. Komisija tikai par paveiktu darbu.
          </p>
          <CTAButton href={`/register?role=carrier`} variant="primary" size="lg">
            Kļūt par šoferi <ArrowRight className="w-6 h-6" />
          </CTAButton>
        </Container>
      </main>
      <Footer />
    </>
  );
}
