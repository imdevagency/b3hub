import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { MapPin, Clock, CheckCircle, Banknote, ArrowRight } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { FAQAccordion } from '@/components/marketing/ui/faq-accordion';

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
          <div className="w-full bg-background rounded-3xl shadow-xl flex flex-col text-sm self-center overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 text-foreground">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                Jauns darbs
              </span>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 text-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
                  Karjers &quot;Liepa&quot; → Būvlaukums Rīgā
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 bg-neutral-50 rounded-2xl p-4 mt-2">
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
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-neutral-100 rounded-full py-3 text-center text-sm font-medium text-muted-foreground flex items-center justify-center cursor-pointer hover:bg-neutral-200 transition-colors">
                  Noraidīt
                </div>
                <div className="bg-foreground rounded-full text-background py-3 text-center text-sm font-medium flex items-center justify-center cursor-pointer hover:bg-foreground/90 transition-colors">
                  Pieņemt darbu
                </div>
              </div>

              {/* Auto-doc note */}
              <div className="flex items-start gap-3 text-xs text-primary bg-primary/5 rounded-2xl p-4">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>CMR un svara zīme tiks ģenerēti automātiski pēc izkraušanas.</span>
              </div>
            </div>
          </div>
        </Hero>

        {/* ── EARNINGS ── */}
        <section className="w-full bg-[#203728] text-white">
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
        <section className="w-full bg-background mt-48">
          <Container className="py-24">
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
                <div className="sticky top-32 w-full max-w-sm mx-auto aspect-9/18 bg-white rounded-[4rem] p-4 flex flex-col shadow-2xl ring-1 ring-neutral-200 border-8 border-neutral-100">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-neutral-100 rounded-b-2xl z-20" />

                  {/* Status bar */}
                  <div className="w-full h-10 mt-4 flex items-center justify-between px-5">
                    <span className="text-[10px] font-semibold text-neutral-400 tracking-wide">
                      13:27
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-2 bg-neutral-300 rounded-sm" />
                      <div className="w-3 h-2 bg-neutral-300 rounded-sm" />
                    </div>
                  </div>

                  {/* Internal UI */}
                  <div className="flex-1 flex flex-col gap-3 py-2 px-2 overflow-hidden relative">
                    {/* Page title */}
                    <div className="px-2 pt-1 pb-2">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">
                        Aktīvais darbs
                      </p>
                      <p className="text-xl font-bold text-neutral-900 tracking-tight leading-tight">
                        Atkritumu grants — 22 t
                      </p>
                    </div>

                    {/* Active Trip Card */}
                    <div className="w-full bg-neutral-50 border border-neutral-100 rounded-3xl p-4 flex flex-col gap-4">
                      {/* Route */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center gap-0.5 mt-1 shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-neutral-400" />
                          <div className="w-0.5 h-8 bg-neutral-200 rounded-full" />
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        </div>
                        <div className="flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-semibold text-neutral-900">
                              Karjers &quot;Liepa&quot;
                            </p>
                            <p className="text-[10px] text-neutral-400">Iekraušana</p>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-neutral-900">
                              Zolitudes iela 11a, Rīga
                            </p>
                            <p className="text-[10px] text-neutral-400">Izkraušana</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 bg-white rounded-2xl p-3 border border-neutral-100">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
                            Attālums
                          </p>
                          <p className="text-sm font-bold text-neutral-900">48 km</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
                            Laiks
                          </p>
                          <p className="text-sm font-bold text-neutral-900">~1h 45m</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
                            Izpeļņa
                          </p>
                          <p className="text-sm font-bold text-neutral-900">€122</p>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#203728] rounded-2xl py-3 flex items-center justify-center text-[11px] font-bold text-white cursor-pointer">
                          Sākt navigāciju
                        </div>
                        <div className="w-10 h-10 bg-neutral-100 rounded-2xl flex items-center justify-center cursor-pointer shrink-0">
                          <MapPin className="w-4 h-4 text-neutral-500" />
                        </div>
                      </div>
                    </div>

                    {/* Completed trip (faded) */}
                    <div className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-3 flex gap-3 items-center opacity-60">
                      <div className="w-9 h-9 bg-neutral-200 rounded-xl shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="w-1/2 h-2 bg-neutral-200 rounded-full" />
                        <div className="w-1/3 h-1.5 bg-neutral-100 rounded-full" />
                      </div>
                      <div className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Pabeigts
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── FAQ ── */}
        <FAQAccordion
          className="bg-background"
          items={[
            {
              q: 'Vai tu vari pievienoties?',
              a: 'Ja tev ir kravas auto un tālrunis — viss pārējais ir atrisināts. Nepieciešams: Latvijā reģistrēts kravas auto vai traktors, derīga vadītāja apliecība (C / CE kategorija), transportlīdzekļa apdrošināšana (OCTA) un viedtālrunis ar Android vai iOS.',
            },
            {
              q: 'Vai man jāstrādā noteiktā reģionā?',
              a: 'Nē. Jūs brīvi izvēlaties darbus visā Latvijā atbilstoši savai atrašanās vietai un maršrutam.',
            },
            {
              q: 'Kas notiek, ja nevaru pabeigt reisu?',
              a: 'Reisu var atcelt pirms iekraušanas bez sekām. Pēc iekraušanas — sazinieties ar atbalstu tieši lietotnē.',
            },
          ]}
        />

        {/* ── CTA ── */}
        <section className="w-full bg-[#203728] text-white py-32">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left">
            <div className="flex flex-col gap-4">
              <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none">
                Nākamais reiss — tavs.
              </h2>
              <p className="text-background/70 font-light text-xl">
                Reģistrācija bez maksas. Komisija tikai par paveiktu darbu.
              </p>
            </div>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register?role=carrier`} variant="inverted" size="lg">
                Kļūt par šoferi <ArrowRight className="w-6 h-6 ml-2" />
              </CTAButton>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
