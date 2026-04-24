import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, LayoutList, Filter, Bell, BarChart2 } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: LayoutList,
    title: 'Visi pasūtījumi vienā sarakstā',
    body: 'Visi aktīvie un vēsturiskie pasūtījumi no visiem projektiem un piegādātājiem — vienā strukturētā skatā ar meklēšanu un filtriem.',
  },
  {
    icon: Filter,
    title: 'Filtrēšana pēc statusa un projekta',
    body: 'Filtrē pēc statusa (gaidoši, aktīvi, pabeigti), projekta, piegādātāja vai datuma. Atrod jebkuru pasūtījumu sekundēs.',
  },
  {
    icon: Bell,
    title: 'Reāllaika statusa atjauninājumi',
    body: 'Pasūtījuma statuss mainās reāllaikā — no apstiprināšanas līdz piegādei. Skatāms no datora un mobilā telefona.',
  },
  {
    icon: BarChart2,
    title: 'Apjoma un izmaksu statistika',
    body: 'Redzi kopējo pasūtīto daudzumu, izmaksas pa mēnešiem un aktīvo pasūtījumu skaitu. Viss pārskatāmi bez Exceļa.',
  },
];

export default function PasutijumuParskatPage() {
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
          eyebrow="Pasūtījumu Pārskats"
          title={
            <>
              Visi pasūtījumi —
              <br />
              vienā skatā.
            </>
          }
          subtitle="Aktīvie braucieni, gaidošie apstiprinājumi un piegādātā vēsture — vienā sarakstā ar filtriem un reāllaika statusiem."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt izmantot
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-bold">Pasūtījumi</span>
              <span className="text-xs text-muted-foreground">Aprīlis 2026</span>
            </div>
            <div className="flex gap-2 px-6 py-3 border-b border-border overflow-x-auto">
              {['Visi (38)', 'Aktīvi (6)', 'Gaidoši (3)', 'Pabeigti (29)'].map((tab, i) => (
                <span
                  key={tab}
                  className={`text-xs font-bold whitespace-nowrap px-3 py-1.5 border shrink-0 ${i === 0 ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}
                >
                  {tab}
                </span>
              ))}
            </div>
            {[
              {
                id: 'B3-2854',
                material: 'Granīta šķembas 20/40',
                status: 'Piegādāts',
                date: '14.04.',
              },
              { id: 'B3-2853', material: 'Smiltis 0–4 mm', status: 'Braucienā', date: '14.04.' },
              { id: 'B3-2851', material: 'Grants 8–16 mm', status: 'Gaida apst.', date: '13.04.' },
            ].map(({ id, material, status, date }) => (
              <div
                key={id}
                className="flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="font-bold text-xs">{material}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {id} · {date}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold tracking-wide ${status === 'Piegādāts' ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </Hero>

        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Ko dod pilns pārskats
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

        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              No pasūtīšanas līdz arhīvam
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Izveido pasūtījumu',
                  body: 'Izvēlies materiālu, daudzumu un piegādes datumu no kataloga.',
                },
                {
                  step: '02',
                  title: 'Piegādātājs apstiprina',
                  body: 'Pasūtījums pāriet "Apstiprināts" statusā — redzams sarakstā reāllaikā.',
                },
                {
                  step: '03',
                  title: 'Seko piegādei',
                  body: 'Brauciena laikā statuss mainās uz "Braucienā" — ar GPS kartes skatījumu.',
                },
                {
                  step: '04',
                  title: 'Arhīvā automātiski',
                  body: 'Pēc piegādes pasūtījums nokrīt "Pabeigts" ar visiem dokumentiem.',
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

        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Kontrolē visu
              <br />
              no vienas vietas.
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
    </>
  );
}
