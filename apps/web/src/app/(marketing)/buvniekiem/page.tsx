import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { FAQAccordion } from '@/components/marketing/ui/faq-accordion';

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
              <CTAButton href={`/register`} variant="primary" size="lg">
                Sākt bez maksas
              </CTAButton>
            </>
          }
        >
          {/* Right: mock live delivery card */}
          <div className="w-full bg-background rounded-3xl shadow-xl flex flex-col text-sm self-center overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-neutral-50">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                B3-2847
              </span>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                Aktīvs
              </span>
            </div>
            <div className="flex flex-col gap-6 p-8">
              <div>
                <p className="text-2xl font-bold tracking-tight leading-none mb-2">
                  Granīta šķembas 20-40
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  22 tonnas · Karjers &quot;Liepa&quot;
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
              <div className="flex items-center gap-4 bg-neutral-50 rounded-2xl p-4 mt-2">
                <div className="h-10 w-10 rounded-full bg-background shadow-sm flex items-center justify-center text-xs font-bold shrink-0">
                  AK
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-base">Andris K.</p>
                  <p className="text-xs text-muted-foreground">MAN TGX · LV-3847</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 bg-background px-2.5 py-1 rounded-full shadow-sm">
                  ~15 min
                </p>
              </div>

              {/* Auto-doc note */}
              <div className="flex items-start gap-3 text-xs text-primary bg-primary/5 rounded-2xl p-4">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>
                  Svara zīme un CMR tiks ģenerēti automātiski pēc piegādes apstiprināšanas.
                </span>
              </div>
            </div>
          </div>
        </Hero>

        {/* ── BENTO FEATURES ── */}
        <section className="w-full bg-background">
          <Container className="py-24">
            <div className="flex flex-col gap-16">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mb-4">
                  Mazāk vietas kļūdām.
                  <br />
                  Vairāk laika darbam.
                </h2>
                <p className="text-xl text-muted-foreground font-light leading-relaxed">
                  B3Hub digitalizē visu piegādes ķēdi no karjera līdz objektam. Vairs nekādu
                  pazaudētu svara zīmju un lieku zvanu.
                </p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
                {/* Feature 1: Large Wide */}
                <div className="md:col-span-2 bg-neutral-100 rounded-[2rem] p-8 md:p-12 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="z-10 max-w-sm">
                    <h3 className="text-3xl font-bold tracking-tight mb-3">
                      Reāllaika GPS izsekošana
                    </h3>
                    <p className="text-muted-foreground font-light text-lg leading-relaxed">
                      Seko līdzi katram auto no iekraušanas līdz būvobjektam bez WhatsApp zvaniem.
                    </p>
                  </div>
                  {/* Decorative map mock */}
                  <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-background rounded-3xl shadow-2xl skew-x-[-5deg] rotate-[5deg] transition-transform group-hover:rotate-0 group-hover:skew-x-0 duration-500 ease-out items-center justify-center overflow-hidden hidden md:flex">
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
                <div className="bg-neutral-100 rounded-[2rem] p-8 md:p-12 flex flex-col justify-between text-center relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <CheckCircle className="w-32 h-32" />
                  </div>
                  <h3 className="text-7xl font-black tracking-tighter mb-2 z-10 mt-auto">0</h3>
                  <p className="text-muted-foreground font-light text-lg z-10 leading-snug">
                    Pazaudētu svara zīmju un CMR. Viss automātiski.
                  </p>
                </div>

                {/* Feature 3: Small Square */}
                <div className="bg-neutral-100 rounded-[2rem] p-8 md:p-12 flex flex-col justify-between text-center shadow-sm">
                  <h3 className="text-4xl font-bold tracking-tight mb-3 mt-auto">Katalogs</h3>
                  <p className="text-muted-foreground font-light text-lg leading-snug">
                    Karjeru un piegādātāju cenas un pieejamība vienā vietā.
                  </p>
                </div>

                {/* Feature 4: Medium Wide */}
                <div className="md:col-span-2 bg-foreground text-background rounded-[2rem] p-8 md:p-12 flex flex-col justify-between overflow-hidden relative shadow-lg">
                  <div className="z-10 max-w-sm">
                    <h3 className="text-3xl font-bold tracking-tight mb-3">
                      Vienots apkopots rēķins
                    </h3>
                    <p className="text-background/70 font-light text-lg leading-relaxed">
                      Saņem vienu strukturētu rēķinu par visām mēneša piegādēm, eksportējamu
                      jebkurai grāmatvedībai.
                    </p>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute right-0 bottom-0 top-0 w-1/2 bg-linear-to-l from-background/10 to-transparent items-center justify-end pr-12 hidden md:flex">
                    <div className="w-48 h-32 bg-background/10 backdrop-blur-md border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                      <span className="text-xl font-bold text-white tracking-widest uppercase">
                        E-RĒĶINS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── STICKY JOURNEY ── */}
        <section className="w-full bg-neutral-50">
          <Container className="py-24">
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
                <div className="sticky top-32 w-full max-w-md mx-auto aspect-9/18 bg-background rounded-[4rem] p-4 flex flex-col gap-2 shadow-2xl ring-1 ring-border border-8 border-neutral-100">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-neutral-100 rounded-b-2xl z-20" />

                  {/* App header mock */}
                  <div className="w-full h-14 mt-4 flex gap-3 items-center px-4">
                    <div className="w-8 h-8 rounded-full bg-foreground" />
                    <div className="h-3 w-32 bg-foreground/90 rounded-full" />
                  </div>

                  {/* App body mock */}
                  <div className="flex-1 flex flex-col gap-4 py-4 px-2 overflow-hidden relative">
                    <div className="w-full h-56 bg-background ring-1 ring-border border-b-2 border-b-border rounded-3xl flex items-center justify-center p-6">
                      <div className="w-full h-full rounded-2xl flex items-center justify-center text-muted-foreground font-medium text-xl text-center bg-neutral-100/50">
                        Solis mainās <br />
                        ritinot
                      </div>
                    </div>
                    <div className="w-full h-20 bg-background ring-1 ring-border rounded-2xl p-4 flex gap-4 items-center">
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl" />
                      <div className="flex-1 flex flex-col gap-2 justify-center">
                        <div className="w-2/3 h-2 bg-muted-foreground rounded-full" />
                        <div className="w-1/3 h-2 bg-neutral-200 rounded-full" />
                      </div>
                    </div>
                    <div className="w-full h-20 bg-background ring-1 ring-border rounded-2xl p-4 flex gap-4 opacity-40 items-center">
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl" />
                      <div className="flex-1 flex flex-col gap-2 justify-center">
                        <div className="w-1/2 h-2 bg-muted-foreground rounded-full" />
                        <div className="w-1/4 h-2 bg-neutral-200 rounded-full" />
                      </div>
                    </div>
                    {/* Gradient fade at bottom of mockup */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
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
          ]}
        />

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left">
            <div className="flex flex-col gap-4">
              <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-none">
                Aizmirsti par papīriem.
              </h2>
              <p className="text-background/70 font-light text-xl">
                Bezmaksas. Nav kreditkartes. Sāc šodien.
              </p>
            </div>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Izveidot kontu <ArrowRight className="w-6 h-6 ml-2" />
              </CTAButton>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
