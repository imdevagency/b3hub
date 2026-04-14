import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { CTAButton } from '@/components/ui/cta-button';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const problems = [
  { old: 'Zvani karjeriem un šoferiem', new: 'Cenas un pieejamība uzreiz' },
  { old: 'Piegādes sekošana WhatsApp', new: 'Reāllaika GPS izsekošana' },
  { old: 'Papīra svara zīmes un CMR', new: 'Visi dokumenti ģenerēti automātiski' },
  { old: 'Rēķini no 10 dažādiem piegādātājiem', new: 'Viss pārskatāms vienā projektā' },
];

const journey = [
  {
    step: '01',
    title: 'Izvēlies',
    body: 'Atrodi materiālu katalogā ar reālo cenu un pieejamību. Nav zvanu, nav derğibu.',
    features: ['Cenas no 240+ piegādātājiem', 'Piegāde ieplānota uzreiz'],
  },
  {
    step: '02',
    title: 'Izseko',
    body: 'Seko kravas auto GPS reāllaikā no iekraušanas brīža līdz tavai būvvietai.',
    features: ['Paziņojumi lietotnē', 'Precīzs ierašanās laiks'],
  },
  {
    step: '03',
    title: 'Saņem',
    body: 'Piegāde apstiprināta — svara zīme, CMR un rēķins jau ir sagatavoti.',
    features: ['Digitāla svara zīme un CMR', 'Rēķins uz e-pastu automātiski'],
  },
];

export default function BuvnieckiemPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-clip">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Būvniekiem"
          title={
            <>
              Piegāde plkst.&nbsp;7:00.
              <br />
              Vai tu zini,
              <br />
              kur ir auto?
            </>
          }
          subtitle="B3Hub dod reāllaika GPS, automātiskus dokumentus un caurspīdīgas cenas — bez Excel un WhatsApp."
          actions={
            <>
              <CTAButton href={`${APP_URL}/register`} variant="primary" size="lg">
                Sākt bez maksas
              </CTAButton>
            </>
          }
        >
          {/* Right: mock live delivery card */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                B3-2847
              </span>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground" />
                Aktīvs
              </span>
            </div>
            <div className="flex flex-col gap-6 p-8">
              <div>
                <p className="text-2xl font-bold tracking-tight leading-none mb-2">
                  Granīta šķembas 20-40
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  22 tonnas · Karjers "Liepa"
                </p>
              </div>

              {/* Progress */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Iekrauts 13:45</span>
                  <span>~15:20 ierašanās</span>
                </div>
                <div className="relative w-full h-px bg-border">
                  <div className="absolute top-0 left-0 h-px bg-foreground w-3/4" />
                  <div className="absolute top-1/2 left-3/4 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-foreground border-2 border-background" />
                </div>
              </div>

              {/* Driver */}
              <div className="flex items-center gap-4 border-t border-border pt-6">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  AK
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Andris K.</p>
                  <p className="text-xs text-muted-foreground">MAN TGX · LV-3847</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">~15 min</p>
              </div>

              {/* Auto-doc note */}
              <div className="flex items-start gap-3 text-xs text-muted-foreground border border-border p-4">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>
                  Svara zīme un CMR tiks ģenerēti automātiski pēc piegādes apstiprināšanas.
                </span>
              </div>
            </div>
          </div>
        </Hero>

        {/* ── BENTO FEATURES ── */}
        <Container as="section" className="py-24 border-t border-border">
          <div className="flex flex-col gap-16">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mb-4">
                Mazāk vietas kļūdām.
                <br />
                Vairāk laika darbam.
              </h2>
              <p className="text-xl text-muted-foreground font-light">
                B3Hub digitalizē visu piegādes ķēdi no karjera līdz objektam. Vairs nekādu pazaudētu
                svara zīmju un lieku zvanu.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[280px]">
              {/* Feature 1: Large Wide */}
              <div className="md:col-span-2 bg-muted/30 border border-border p-8 flex flex-col justify-between group overflow-hidden relative">
                <div className="z-10 max-w-sm">
                  <h3 className="text-2xl font-bold tracking-tight mb-2">
                    Reāllaika GPS izsekošana
                  </h3>
                  <p className="text-muted-foreground font-light text-lg">
                    Seko līdzi katram auto no iekraušanas līdz būvobjektam bez WhatsApp zvaniem.
                  </p>
                </div>
                {/* Decorative map mock */}
                <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-background border border-border rounded-2xl shadow-2xl skew-x-[-5deg] rotate-[5deg] transition-transform group-hover:rotate-0 group-hover:skew-x-0 duration-500 ease-out items-center justify-center overflow-hidden hidden md:flex">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="w-16 h-16 bg-foreground text-background rounded-full flex items-center justify-center animate-pulse shadow-xl shadow-foreground/20 z-2">
                    <span className="font-bold text-lg">Auto</span>
                  </div>
                </div>
              </div>

              {/* Feature 2: Small Square */}
              <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CheckCircle className="w-24 h-24" />
                </div>
                <h3 className="text-6xl font-black tracking-tighter mb-2 z-10 mt-auto">0</h3>
                <p className="text-muted-foreground font-light z-10">
                  Pazaudētu svara zīmju un CMR. Viss automātiski.
                </p>
              </div>

              {/* Feature 3: Small Square */}
              <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center">
                <h3 className="text-3xl font-bold tracking-tight mb-3 mt-auto">Katalogs</h3>
                <p className="text-muted-foreground font-light">
                  Karjeru un piegādātāju cenas un pieejamība vienā vietā.
                </p>
              </div>

              {/* Feature 4: Medium Wide */}
              <div className="md:col-span-2 bg-foreground text-background p-8 flex flex-col justify-between overflow-hidden relative">
                <div className="z-10 max-w-sm">
                  <h3 className="text-2xl font-bold tracking-tight mb-2">
                    Vienots apkopots rēķins
                  </h3>
                  <p className="text-background/70 font-light text-lg">
                    Saņem vienu strukturētu rēķinu par visām mēneša piegādēm, eksportējamu jebkurai
                    grāmatvedībai.
                  </p>
                </div>
                {/* Decorative element */}
                <div className="absolute right-0 bottom-0 top-0 w-1/2 bg-linear-to-l from-background/20 to-transparent items-center justify-end pr-8 hidden md:flex">
                  <div className="w-48 h-32 bg-background/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl font-bold text-white tracking-widest uppercase">
                      E-RĒĶINS
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

            {/* Right: Sticky Mockup Wrapper */}
            <div className="md:w-1/2 relative hidden md:block">
              <div className="sticky top-32 w-full max-w-md mx-auto aspect-9/18 bg-muted/20 border border-border rounded-[3rem] p-4 flex flex-col gap-2 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-border rounded-b-2xl z-20" />

                {/* App header mock */}
                <div className="w-full h-14 mt-4 flex gap-3 items-center px-4">
                  <div className="w-8 h-8 rounded-full bg-foreground" />
                  <div className="h-3 w-32 bg-foreground/90 rounded-full" />
                </div>

                {/* App body mock */}
                <div className="flex-1 flex flex-col gap-4 py-4 px-2 overflow-hidden relative">
                  <div className="w-full h-56 bg-background border border-border shadow-sm rounded-2xl flex items-center justify-center p-6">
                    <div className="w-full h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground font-medium text-xl">
                      Solis mainās <br />
                      ritinot
                    </div>
                  </div>
                  <div className="w-full h-20 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4">
                    <div className="w-12 h-12 bg-muted rounded-xl" />
                    <div className="flex-1 flex flex-col gap-2 justify-center">
                      <div className="w-2/3 h-2 bg-muted-foreground rounded-full" />
                      <div className="w-1/3 h-2 bg-muted rounded-full" />
                    </div>
                  </div>
                  <div className="w-full h-20 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4 opacity-50">
                    <div className="w-12 h-12 bg-muted rounded-xl" />
                    <div className="flex-1 flex flex-col gap-2 justify-center">
                      <div className="w-2/3 h-2 bg-muted-foreground rounded-full" />
                      <div className="w-1/3 h-2 bg-muted rounded-full" />
                    </div>
                  </div>
                  {/* Gradient fade at bottom of mockup */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-muted/20 to-transparent" />
                </div>
              </div>
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
                  q: 'Cik maksā izmantot B3Hub kā pircējam?',
                  a: 'Pilnīgi bezmaksas. Nav abonēšanas maksas, nav komisijas no piegādēm.',
                },
                {
                  q: 'Kā notiek piegādes izsekošana?',
                  a: 'Reāllaika GPS kartē. Saņemat paziņojumus, kad šoferis izbrauc, ierodoties un pēc izkraušanas.',
                },
                {
                  q: 'Vai var pasūtīt no vairākiem piegādātājiem vienlaikus?',
                  a: 'Jā. Katrs pasūtījums ir atsevišķs — var izveidot vairākus vienā dienā no dažādiem avotiem.',
                },
                {
                  q: 'Kā saņemu rēķinus?',
                  a: 'Automātiski pēc katras piegādes apstiprināšanas. PDF pieejams lietotnē un nosūtīts uz jūsu e-pastu.',
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
            Aizmirsti par papīriem.
          </h2>
          <p className="text-muted-foreground font-light text-lg">
            Bezmaksas. Nav kreditkartes. Sāc šodien.
          </p>
          <CTAButton href={`${APP_URL}/register`} variant="primary" size="lg">
            Izveidot kontu <ArrowRight className="w-6 h-6" />
          </CTAButton>
        </Container>
      </main>
      <Footer />
    </>
  );
}
