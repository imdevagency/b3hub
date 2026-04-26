import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { MapPin, Clock, CheckCircle, Banknote, ArrowRight } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';

const journey = [
  {
    step: '01',
    title: 'Pilns pārskats pirms izbraukšanas',
    body: 'Pirms pieņem darbu, tu gūsti pilnu kontroli: precīzs maršruts, kilometri un krava. Un pats galvenais — tūlītēji un skaidri redzama izpeļņa eiro.',
    features: ['Piedāvājumi atbilstoši atrašanās vietai', 'Nekādu slēptu nosacījumu'],
  },
  {
    step: '02',
    title: 'Viena lietotne visam reisam',
    body: 'Aizmirsti par mētāšanos starp WhatsApp, SMS un Google Maps. Mēs vedam tevi cauri karjeram un tieši uz būvobjektu.',
    features: ['Iebūvēta navigācija abiem punktiem', 'Poga saziņai ar pasūtītāju'],
  },
  {
    step: '03',
    title: 'Nodošana bez papīriem',
    body: 'Ierodies objektā. Klients parakstās uz tava telefona ekrāna, un E-CMR kopā ar rēķinu ģenerējas automātiski tajā pašā sekundē.',
    features: ['Klients parakstās tieši lietotnē', 'Aizmirsti par zīmogiem un dzeltenajām lapām'],
  },
];

const earnings = [
  { type: 'Vietējais reiss (< 50 km)', rate: '€85–€140 / reiss' },
  { type: 'Reģionālais reiss (50–150 km)', rate: '€160–€280 / reiss' },
  { type: 'Skip hire piegāde', rate: '€65–€95 / piegāde' },
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
        <section className="w-full bg-foreground text-background">
          <Container className="py-32 flex flex-col">
            <div className="flex flex-col md:flex-row gap-12 border-b border-background/20 pb-16 mb-8">
              <div className="md:w-1/2">
                <p className="text-sm font-bold tracking-widest uppercase text-background/40 mb-6">
                  Izpeļņa
                </p>
                <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none">
                  Reālas likmes.
                  <br />
                  Nekādu pārsteigumu.
                </h2>
              </div>
              <div className="md:w-1/2 flex items-end">
                <p className="text-lg font-light text-background/60 leading-relaxed">
                  Indikatīvas likmes Latvijā. Atkarīgs no reģiona, sezonas un kravas veida. Komisija
                  8% — nav citu maksu.
                </p>
              </div>
            </div>
            <div className="flex flex-col">
              {earnings.map((e) => (
                <div
                  key={e.type}
                  className="flex flex-col md:flex-row justify-between py-8 border-b border-background/10 md:items-center gap-2"
                >
                  <span className="text-xl md:text-2xl font-light tracking-tight text-background/60">
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

        {/* ── STICKY JOURNEY ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col md:flex-row gap-16 relative pb-32">
            {/* Left: Scrollable Text Steps */}
            <div className="md:w-1/2 flex flex-col gap-40 py-24">
              {journey.map((item) => (
                <div key={item.step} className="flex flex-col gap-5 pr-8">
                  <span className="text-sm font-bold tracking-widest uppercase text-primary border-b border-border pb-4 w-12">
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
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Right: Sticky Phone Mockup */}
            <div className="md:w-1/2 relative hidden md:block">
              <div className="sticky top-32 w-full max-w-md mx-auto aspect-9/18 bg-foreground border border-border rounded-[3rem] p-4 flex flex-col gap-2 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-border rounded-b-2xl z-20" />

                {/* App header */}
                <div className="w-full h-14 mt-4 flex gap-3 items-center px-4">
                  <div className="w-8 h-8 rounded-full bg-background/20" />
                  <div className="h-3 w-32 bg-background/20 rounded-full" />
                  <div className="ml-auto w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                </div>

                {/* Internal UI */}
                <div className="flex-1 flex flex-col gap-4 py-4 px-2 overflow-hidden relative text-background">
                  {/* Current Active Trip */}
                  <div className="w-full bg-background/10 border border-background/10 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <span className="text-xs uppercase tracking-widest text-primary font-bold">
                        AKTĪVS REISS
                      </span>
                      <span className="text-xl font-bold tracking-tight">€122.00</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <div className="w-3 h-3 rounded-full bg-background border-2 border-primary" />
                          <div className="w-0.5 h-8 bg-background/20 rounded-full" />
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                        <div className="flex flex-col justify-between py-0.5">
                          <div>
                            <p className="text-sm font-bold">Karjers "Liepa"</p>
                            <p className="text-xs text-background/50">Iekraušana</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">Zolitudes iela 11a, Rīga</p>
                            <p className="text-xs text-background/50">Izkraušana</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-4 border-t border-background/10">
                      <div className="h-10 flex-1 bg-primary text-background rounded-lg flex items-center justify-center text-sm font-bold">
                        Sākt Navigāciju
                      </div>
                      <div className="h-10 w-10 bg-background/20 rounded-lg flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-background" />
                      </div>
                    </div>
                  </div>

                  {/* Future / Finished trips faded */}
                  <div className="w-full h-20 bg-background/5 border border-background/5 rounded-2xl p-4 flex gap-4 opacity-50 items-center">
                    <div className="w-12 h-12 bg-background/10 rounded-full" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="w-1/2 h-2.5 bg-background/20 rounded-full" />
                      <div className="w-1/3 h-2 bg-background/10 rounded-full" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-foreground to-transparent" />
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
                  q: 'Vai man jāstrādā noteiktā reģionā?',
                  a: 'Nē. Jūs brīvi izvēlaties darbus visā Latvijā atbilstoši savai atrašanās vietai un maršrutam.',
                },
                {
                  q: 'Kas notiek, ja nevaru pabeigt reisu?',
                  a: 'Reisu var atcelt pirms iekraušanas bez sekām. Pēc iekraušanas — sazinieties ar atbalstu tieši lietotnē.',
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
    </>
  );
}
