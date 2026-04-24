import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, FileSignature, CalendarRange, BarChart3, RefreshCw } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: FileSignature,
    title: 'Viens līgums — neierobežoti izsaukumi',
    body: 'Nofiksē cenu, apjomu un piegādes nosacījumus ietvara līgumā. Katru reizi, kad vajadzīga piegāde, izveido izsaukumu atbilstoši līgumam — bez atkārtotas sarunu vedšanas.',
  },
  {
    icon: CalendarRange,
    title: 'Izsaukumu plānošana un grafiks',
    body: 'Plāno izsaukumus uz priekšu. Piegādātājs un pārvadātājs redz grafiku savlaicīgi — nav pēdējā brīža zvanu.',
  },
  {
    icon: BarChart3,
    title: 'Apjomu kontrole un atskaite',
    body: 'Platforma seko izpildītajam apjomam pret līgumā noteikto. Jebkurā brīdī redzi, cik procenti no nolīgtā apjoma jau ir piegādāts.',
  },
  {
    icon: RefreshCw,
    title: 'Automātiskie dokumenti pie katra izsaukuma',
    body: 'Svara zīme, CMR un rēķins tiek sagatavoti automātiski katram izsaukumam — tāpat kā parastos pasūtījumos.',
  },
];

export default function IetvaraLigumiPage() {
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
          eyebrow="Ietvara Līgumi"
          title={
            <>
              Līgums vienreiz.
              <br />
              Pasūtī visu
              <br />
              sezonu.
            </>
          }
          subtitle="Nofiksē cenu un nosacījumus ietvara līgumā, tad izveido izsaukumus pēc vajadzības. Nav atkārtotu sarunu, nav papīra pielikumu."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Izveidot pirmo līgumu
            </CTAButton>
          }
        >
          {/* Mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-foreground text-background">
              <span className="font-bold text-sm">Ietvara līgums ILG-014</span>
              <span className="font-mono text-xs opacity-60">Aktīvs</span>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Piegādātājs</p>
                  <p className="font-medium text-sm">Karjers "Liepa" SIA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Materiāls</p>
                  <p className="font-medium text-sm">Granīta šķembas 20–40</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nolīgtais apjoms</p>
                  <p className="font-bold text-sm">500 t</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Izpildīts</p>
                  <p className="font-bold text-sm">320 t (64%)</p>
                </div>
              </div>
              <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-foreground rounded-full w-[64%]" />
              </div>
              <div className="flex gap-3 border-t border-border pt-5">
                <div className="flex-1 bg-muted/20 border border-border py-2.5 text-center text-xs font-bold tracking-wide uppercase">
                  Vēsture (5)
                </div>
                <div className="flex-1 bg-foreground text-background py-2.5 text-center text-xs font-bold tracking-wide uppercase">
                  Jauns izsaukums
                </div>
              </div>
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc ietvara līgumi
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
              Kā tas darbojas
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Izveido līgumu',
                  body: 'Nofiksē piegādātāju, materiālu, vienības cenu un kopējo apjomu.',
                },
                {
                  step: '02',
                  title: 'Pievieno projektu',
                  body: 'Līgums ir piesaistīts konkrētam projektam vai būvvietai.',
                },
                {
                  step: '03',
                  title: 'Izveido izsaukumu',
                  body: 'Kad vajadzīga piegāde, izveido izsaukumu — norādi datumu un apjomu.',
                },
                {
                  step: '04',
                  title: 'Dokumenti automātiski',
                  body: 'Svara zīme, CMR un rēķins tiek sagatavoti tāpat kā jebkuram pasūtījumam.',
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
              Pārtrauc katru reizi
              <br />
              sākt no nulles.
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
