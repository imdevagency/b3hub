import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, SlidersHorizontal, MapPin, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: SlidersHorizontal,
    title: 'Pats nosaki savu darba zonu',
    body: 'Katrs pārvadātājs iestata savu maksimālo rādiusu kilometros. Darbi ārpus šī rādiusa netiek rādīti — nav nevēlamu piedāvājumu.',
  },
  {
    icon: MapPin,
    title: 'Atbilstošs darbs uzreiz',
    body: 'Sistēma automātiski filtrē pieejamos pasūtījumus pēc iekraušanas vietas. Šoferis redz tikai tos darbus, kurus var izpildīt.',
  },
  {
    icon: Clock,
    title: 'Mazāk tukšo braucienu',
    body: 'Precīzs rādiuss nozīmē, ka šoferis nepavada laiku braucot uz neērtām vietām. Vairāk lietderīgu kilometru, mazāk tēriņu.',
  },
  {
    icon: TrendingUp,
    title: 'Labāka kapacitātes izmantošana',
    body: 'Dispečeris uzņēmuma līmenī var iestatīt rādiusu visam uzņēmumam vai katram auto atsevišķi. Optimāls darbu sadalījums pa floti.',
  },
];

export default function MeklesanasRadiussPage() {
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
          eyebrow="Meklēšanas Rādiuss"
          title={
            <>
              Darbi tikai
              <br />
              tavā zonā.
            </>
          }
          subtitle="Iestati, cik tālu esi gatavs braukt. Platforma rāda tikai tos pasūtījumus, kas atbilst tavām iespējām — nav nevajadzīgu piedāvājumu no otras valsts malas."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt izmantot
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="px-6 py-4 border-b border-border">
              <span className="font-bold text-sm">Darba zonas iestatījumi</span>
            </div>
            <div className="flex flex-col gap-6 p-6">
              <div>
                <p className="text-xs text-muted-foreground mb-3">Maksimālais rādiuss</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-border rounded-full">
                    <div className="h-1.5 w-3/5 bg-foreground rounded-full" />
                  </div>
                  <span className="font-bold text-lg w-16 text-right">120 km</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Rīgas apkārtne', active: true },
                  { label: 'Vidzeme', active: true },
                  { label: 'Zemgale', active: false },
                ].map(({ label, active }) => (
                  <div
                    key={label}
                    className={`border px-3 py-2 text-center text-xs font-bold ${active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="border border-border p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">Pieejamie darbi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Šodien tavā zonā</p>
                </div>
                <span className="text-3xl font-bold">14</span>
              </div>
            </div>
          </div>
        </Hero>

        <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc tas ir svarīgi
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
        </section>

        <section className="w-full bg-background">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Kā tas strādā
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Iestata rādiusu',
                  body: 'Dispečeris vai šoferis norāda maksimālo attālumu savā profilā.',
                },
                {
                  step: '02',
                  title: 'Sistēma filtrē',
                  body: 'Visi jaunie pasūtījumi tiek pārbaudīti pret iekraušanas vietas koordinātām.',
                },
                {
                  step: '03',
                  title: 'Saņem atbilstošo',
                  body: 'Push paziņojums nāk tikai par darbiem, kas iekļaujas definētajā zonā.',
                },
                {
                  step: '04',
                  title: 'Pieņem vai atgriez',
                  body: 'Šoferis izvēlas no savas zonas darbiem — bez nevēlamiem piedāvājumiem.',
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
              Dari darbus
              <br />
              savā apkārtnē.
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
