import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { CTAButton } from '@/components/ui/cta-button';
import { ArrowLeft, MessageSquare, Clock, CheckSquare, Layers } from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const benefits = [
  {
    icon: MessageSquare,
    title: 'Viens pieprasījums — vairāki piedāvājumi',
    body: 'Nosūti cenu pieprasījumu vairākiem piegādātājiem vienlaikus. Visi piedāvājumi nonāk vienā vietā — nav jāzvana katram atsevišķi.',
  },
  {
    icon: Clock,
    title: 'Piegādātāji atbild platformā',
    body: 'Piegādātāji redz pieprasījumu savā portālā un iesniedz cenu tieši sistēmā. Tu saņem paziņojumu, kad piedāvājums ir gatavs.',
  },
  {
    icon: CheckSquare,
    title: 'Salīdzini un apstiprina',
    body: 'Visi piedāvājumi vienā sarakstā ar cenu, pieejamību un piegādes datumu. Apstiprina labāko — pasūtījums tiek izveidots automātiski.',
  },
  {
    icon: Layers,
    title: 'Integrēts ar projektu vadību',
    body: 'Cenu pieprasījums ir piesaistīts projektam. Pēc apstiprināšanas pasūtījums un dokumentācija nonāk pie attiecīgās būvvietas.',
  },
];

export default function RfqPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background w-full overflow-clip">
        {/* Back */}
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        {/* HERO */}
        <Hero
          eyebrow="Cenu Pieprasījumi"
          title={
            <>
              Viens pieprasījums
              <br />
              visiem
              <br />
              piegādātājiem.
            </>
          }
          subtitle="Nosūti cenu pieprasījumu (RFQ) vairākiem piegādātājiem vienlaikus. Saņem salīdzināmus piedāvājumus un apstiprina labāko — vienā vietā."
          actions={
            <CTAButton href={`${APP_URL}/register`} variant="primary" size="lg">
              Sūtīt pirmo pieprasījumu
            </CTAButton>
          }
        >
          {/* Mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-bold text-sm">Cenu pieprasījums CP-038</span>
              <span className="text-xs font-bold tracking-widest uppercase text-foreground">
                3 piedāvājumi
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {[
                { supplier: 'Karjers "Liepa" SIA', price: '€9.50/t', date: 'Rīt', selected: true },
                { supplier: 'Granīts SIA', price: '€10.20/t', date: 'Parīt', selected: false },
                { supplier: 'Akmenssala', price: '€9.80/t', date: 'Rīt', selected: false },
              ].map(({ supplier, price, date, selected }) => (
                <div
                  key={supplier}
                  className={`flex items-center justify-between px-6 py-4 ${selected ? 'bg-foreground text-background' : ''}`}
                >
                  <div>
                    <p className="font-medium text-xs">{supplier}</p>
                    <p
                      className={`text-xs mt-0.5 ${selected ? 'text-background/60' : 'text-muted-foreground'}`}
                    >
                      Piegāde: {date}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm">{price}</span>
                    {selected && (
                      <span className="text-xs font-bold tracking-wide uppercase text-background/70">
                        ✓ Izvēlēts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border">
              <div className="h-10 bg-foreground flex items-center justify-center">
                <span className="text-xs font-bold tracking-wide uppercase text-background">
                  Apstiprināt un pasūtīt
                </span>
              </div>
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc RFQ platformā
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

        {/* FLOW */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              No pieprasījuma līdz piegādei
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Izveido pieprasījumu',
                  body: 'Norādi materiālu, apjomu, piegādes datumu un atrašanās vietu.',
                },
                {
                  step: '02',
                  title: 'Izvēlies piegādātājus',
                  body: 'Nosūti pieprasījumu vienam vai vairākiem kataloga piegādātājiem.',
                },
                {
                  step: '03',
                  title: 'Saņem piedāvājumus',
                  body: 'Piegādātāji atbild platformā. Tu saņem paziņojumu un salīdzini.',
                },
                {
                  step: '04',
                  title: 'Apstiprina un pasūti',
                  body: 'Viena poga — pasūtījums izveidots, dokumenti sagatavoti automātiski.',
                },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="md:px-10 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-4"
                >
                  <span className="text-4xl font-bold tracking-tighter text-border">{step}</span>
                  <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Pārtrauc zvanīt
              <br />
              visiem piegādātājiem.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`${APP_URL}/register`} variant="inverted" size="lg">
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
