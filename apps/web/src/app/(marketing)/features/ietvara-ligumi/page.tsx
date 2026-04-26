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
          <div className="w-full bg-background rounded-3xl shadow-xl flex flex-col text-sm self-center overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-foreground text-background">
              <span className="font-bold text-sm">Ietvara līgums ILG-014</span>
              <span className="font-mono text-xs opacity-60 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-background animate-pulse" />
                Aktīvs
              </span>
            </div>
            <div className="flex flex-col gap-6 p-8">
              <div className="grid grid-cols-2 gap-6 bg-neutral-50 rounded-2xl p-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 tracking-widest uppercase">
                    Piegādātājs
                  </p>
                  <p className="font-medium text-base">Karjers &quot;Liepa&quot; SIA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 tracking-widest uppercase">
                    Materiāls
                  </p>
                  <p className="font-medium text-base">Granīta šķembas 20–40</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 tracking-widest uppercase">
                    Nolīgtais apjoms
                  </p>
                  <p className="font-bold text-base">500 t</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 tracking-widest uppercase">
                    Izpildīts
                  </p>
                  <p className="font-bold text-base text-primary">320 t (64%)</p>
                </div>
              </div>
              <div className="relative w-full h-3 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-foreground rounded-full w-[64%]" />
              </div>
              <div className="flex gap-4 mt-2">
                <div className="flex-1 bg-neutral-100 hover:bg-neutral-200 transition-colors rounded-full py-3.5 text-center text-sm font-bold cursor-pointer">
                  Vēsture (5)
                </div>
                <div className="flex-1 bg-foreground hover:bg-foreground/90 transition-colors text-background rounded-full py-3.5 text-center text-sm font-bold cursor-pointer shadow-sm">
                  Jauns izsaukums
                </div>
              </div>
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <section className="w-full bg-neutral-50 pb-32 pt-16">
          <Container>
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Kāpēc ietvara līgumi
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="p-10 md:p-12 flex flex-col gap-5 bg-background rounded-[2rem] shadow-sm"
                >
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-2 shadow-sm">
                    <Icon className="w-6 h-6 text-foreground" strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground text-lg font-light leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* FLOW */}
        <section className="w-full bg-background">
          <Container className="py-32">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Kā tas darbojas
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  className="bg-neutral-50 rounded-[2rem] p-8 md:p-10 flex flex-col gap-4 shadow-sm"
                >
                  <span className="text-5xl font-black tracking-tighter text-foreground/10 mb-2">
                    {step}
                  </span>
                  <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground font-light text-base leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="w-full bg-background pb-32">
          <Container>
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-12 bg-foreground rounded-[4rem] p-12 md:p-20 shadow-2xl">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-background leading-none max-w-2xl">
                Pārtrauc katru reizi
                <br />
                sākt no nulles.
              </h2>
              <div className="flex flex-col gap-6 min-w-fit shrink-0">
                <CTAButton
                  href={`/register`}
                  variant="inverted"
                  size="lg"
                  className="w-full text-center justify-center"
                >
                  Reģistrēties bez maksas
                </CTAButton>
                <p className="text-center text-background/50 text-sm font-medium tracking-wide uppercase">
                  Nav nepieciešama kredītkarte
                </p>
              </div>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
