import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, ArrowLeftRight, Fuel, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const benefits = [
  {
    icon: ArrowLeftRight,
    title: 'Atgriešanās brauciens ar kravu',
    body: 'Pēc piegādes platforma automātiski meklē pieejamos darbus piegādes vietas tuvumā. Šoferis var uzņemt kravu atpakaļceļā bez dispečera iejaukšanās.',
  },
  {
    icon: Fuel,
    title: 'Mazāk tukšo kilometru',
    body: 'Katrs tukšais brauciens ir zaudēts ienākums un lieka degviela. Atgriešanās braucienu optimizācija samazina tukšo km par vidēji 30%.',
  },
  {
    icon: Clock,
    title: 'Uzreiz — bez zvaniem',
    body: 'Šoferis saņem push paziņojumu ar atgriešanās darba piedāvājumu. Pieņem ar vienu pieskārienu tieši no aktīvā brauciena ekrāna.',
  },
  {
    icon: TrendingUp,
    title: 'Vairāk ienākumu no katras dienas',
    body: 'Šoferis, kas izmanto atgriešanās braucienus, var izpildīt par 20–40% vairāk darbu dienā, nepalielinot nobrauktos kilometrus.',
  },
];

export default function AtgriešanāsBraucieniPage() {
  return (
    <>
      <main className="bg-background w-full overflow-clip">
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        <Hero
          eyebrow="Atgriešanās Braucieni"
          title={
            <>
              Nekad vairāk
              <br />
              tukšs atpakaļ.
            </>
          }
          subtitle="Platforma atrod pieejamus pasūtījumus pie taviem piegādes punktiem un piedāvā tos uzreiz. Mazāk tukšo kilometru — vairāk ienākumu."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt optimizēt maršrutus
            </CTAButton>
          }
        >
          <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
            <div className="px-6 py-5 bg-foreground text-background">
              <span className="font-bold text-sm">Atgriešanās darbs pieejams!</span>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-foreground mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Piegādes vieta (šī brauciena beigas)
                  </p>
                  <p className="font-bold text-sm">Rīga, Pārdaugava</p>
                </div>
              </div>
              <div className="h-px bg-" />
              <div className="bg-neutral-50 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Smilts 0–4 mm · 18 t</span>
                  <span className="font-bold text-sm text-foreground">€74.00</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Iekraušana</p>
                    <p className="font-medium mt-0.5">Smilšu karjers &quot;Ādaži&quot;</p>
                    <p className="text-muted-foreground">4.2 km no tevis</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Piegāde</p>
                    <p className="font-medium mt-0.5">Jūrmala, Lielupes iela</p>
                    <p className="text-muted-foreground">22 km</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 ">
              <div className="py-4 text-center text-xs font-bold text-muted-foreground ">
                Izlaist
              </div>
              <div className="py-4 text-center text-xs font-bold bg-foreground text-background">
                Pieņemt atpakaļceļā
              </div>
            </div>
          </div>
        </Hero>

        <section className="w-full bg-neutral-50 pb-32 pt-16">
          <Container>
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Ko tas dod šoferam
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="p-10 flex flex-col gap-5 bg-background rounded-[2rem] shadow-sm"
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

        <section className="w-full bg-background">
          <Container className="py-32">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Kā tas darbojas automātiski
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  step: '01',
                  title: 'Piegādā kravas',
                  body: 'Šoferis apstiprina piegādi galamērķī un iesniedz attiecīgos dokumentus.',
                },
                {
                  step: '02',
                  title: 'Sistēma meklē',
                  body: 'Algoritms meklē atvērtus pasūtījumus iekraušanas punktiem tuvumā no tavās pašreizējās atrašanāsvietai.',
                },
                {
                  step: '03',
                  title: 'Saņem piedāvājumu',
                  body: 'Push paziņojums ar kravas datiem, attālumu un samaksu — uzreiz pēc piegādes.',
                },
                {
                  step: '04',
                  title: 'Pieņem un brauc',
                  body: 'Pieņem ar vienu pieskārienu. Maršruts uz iekraušanas vietu atveras automātiski.',
                },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="bg-neutral-50 rounded-[2rem] p-8 md:p-10 flex flex-col gap-4 shadow-sm"
                >
                  <span className="text-5xl font-black tracking-tighter text-foreground/10 mb-2">
                    {step}
                  </span>
                  <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="w-full bg-background pb-32">
          <Container>
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-12 bg-foreground rounded-[4rem] p-12 md:p-20 shadow-2xl">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-background leading-none max-w-2xl">
                Katrs brauciens
                <br />
                ar kravu.
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
