import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { Check, ArrowLeft, MapPin, Bell, History, Zap } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: MapPin,
    title: 'Dzīvā pozīcija kartē',
    body: 'Redi katru transporta līdzekli kartē reāllaikā. Precīza pozīcija ar < 30 sekunžu atjauninājumu, ne tikai segmenta prognoze.',
  },
  {
    icon: Bell,
    title: 'Automātiskie push paziņojumi',
    body: 'Saņem paziņojumu, kad auto izbrauc no karjera, ir 15 minūtes pirms ierašanās un kad piegāde apstiprināta.',
  },
  {
    icon: History,
    title: 'Pilns piegādes žurnāls',
    body: 'Katras piegādes maršruts, laiki un posteņi tiek saglabāti. Strīda gadījumā visu var pārbaudīt ar precīziem datiem.',
  },
  {
    icon: Zap,
    title: 'Precīzs ierašanās laiks',
    body: 'ETA tiek aprēķināts dinamiski, ņemot vērā satiksmes situāciju. Nekad vairs negaidi 2 stundas bez informācijas.',
  },
];

export default function GpsIzsekosanaPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-clip">
        {/* ── BACK ── */}
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        {/* ── HERO ── */}
        <Hero
          eyebrow="GPS Izsekošana"
          title={
            <>
              Zini, kur ir
              <br />
              tava krava.
              <br />
              Vienmēr.
            </>
          }
          subtitle="Reāllaika GPS izsekošana no karjera līdz objektam. Paziņojumi telefonā, precīzs ierašanās laiks un pilns žurnāls — bez WhatsApp zvaniem."
          actions={
            <>
              <CTAButton href={`/register`} variant="primary" size="lg">
                Izmēģināt bez maksas
              </CTAButton>
            </>
          }
        >
          {/* Live delivery mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                B3-2847
              </span>
              <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground inline-block animate-pulse" />
                Ceļā
              </span>
            </div>
            {/* Map placeholder */}
            <div className="h-52 bg-muted/20 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />
              {/* Road line */}
              <svg
                className="absolute inset-0 w-full h-full opacity-20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 20 160 Q 100 80 200 100 Q 300 120 380 40"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="8 4"
                />
              </svg>
              {/* Truck marker */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 bg-foreground rounded-full flex items-center justify-center text-background text-xs font-bold shadow-xl shadow-foreground/20">
                  AK
                </div>
                <div className="bg-background border border-border px-2.5 py-1 text-xs font-medium shadow-sm whitespace-nowrap">
                  ~18 minūtes
                </div>
              </div>
              {/* Origin dot */}
              <div className="absolute top-3/4 left-8 w-3 h-3 rounded-full bg-muted-foreground/50 border-2 border-background" />
              {/* Destination dot */}
              <div className="absolute top-1/4 right-8 w-3 h-3 rounded-full bg-foreground border-2 border-background" />
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div>
                <p className="text-xl font-bold tracking-tight leading-none mb-1.5">
                  Granīta šķembas 20–40
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  22 tonnas · Karjers "Liepa"
                </p>
              </div>
              {/* ETA progress */}
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
              {/* Notification previews */}
              <div className="flex flex-col gap-2">
                {[
                  { time: '13:46', msg: 'Šoferis Andris K. izbrauca no karjera.' },
                  { time: '15:02', msg: 'Auto ir ~18 minūtes līdz objektam.' },
                ].map(({ time, msg }) => (
                  <div
                    key={time}
                    className="flex items-start gap-3 border border-border px-4 py-3 text-xs"
                  >
                    <span className="font-mono text-muted-foreground shrink-0">{time}</span>
                    <span className="text-muted-foreground">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Hero>

        {/* ── BENEFITS ── */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc GPS izsekošana mainīs tavu darbu
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border divide-y md:divide-y-0 md:divide-x divide-border">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-8 flex flex-col gap-4">
                <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── BEFORE / AFTER ── */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Pirms un pēc
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-border">
              <div className="flex flex-col gap-4 md:pr-16 pb-12 md:pb-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Pirms
                </p>
                {[
                  '"Kur ir auto?" — WhatsApp dispečeram',
                  '"Nezinu, piezvanīšu šoferim."',
                  'Gaidi 2 stundas bez informācijas',
                  'Piegādes laiks nezināms',
                ].map((t) => (
                  <p key={t} className="text-sm text-muted-foreground font-light">
                    {t}
                  </p>
                ))}
              </div>
              <div className="flex flex-col gap-4 md:pl-16 pt-12 md:pt-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Ar B3Hub
                </p>
                {[
                  'Atver lietotni — auto redzams kartē',
                  'Push paziņojums 15 min pirms ierašanās',
                  'Precīzs ETA, dinamiski atjaunināts',
                  'Pilns žurnāls katrai piegādei',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-foreground" strokeWidth={2.5} />
                    <span className="font-light">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Sāc izsekot savas
              <br />
              piegādes šodien.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Reģistrēties bez maksas
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
