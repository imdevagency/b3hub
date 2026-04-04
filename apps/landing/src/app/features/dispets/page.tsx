import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { CTAButton } from '@/components/ui/cta-button';
import { Check, ArrowLeft, Truck, Smartphone, Route, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const benefits = [
  {
    icon: Smartphone,
    title: 'Darbi tieši telefonā',
    body: 'Šoferis saņem piedāvājumu lietotnē ar kravas datiem, iekraušanas vietu, galamērķi un samaksu. Pieņem vai atgriez ar vienu pieskārienu.',
  },
  {
    icon: Route,
    title: 'Maršruts un navigācija iekļauta',
    body: 'Pēc darba pieņemšanas lietotne uzreiz piedāvā navigāciju uz iekraušanas punktu. Visi norādījumi vienā ekrānā.',
  },
  {
    icon: Truck,
    title: 'Digitālie pavadraksti lietotnē',
    body: 'Šoferis apstiprina iekraušanu, sver kravas svaru un pabeidz piegādi digitāli — papīra pavadrakstu vairs nav vajadzīgi.',
  },
  {
    icon: TrendingUp,
    title: 'Izpeļņas pārskats reāllaikā',
    body: 'Pilns pārskats par visiem paveiktajiem reisiem, izpeļņu un izmaksām. Motivē šoferus pieņemt vairāk darbu.',
  },
];

export default function DispetsPage() {
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
          eyebrow="Šoferu Dispečerizācija"
          title={
            <>
              Darbi šoferiem —
              <br />
              bez zvaniem
              <br />
              dispečeram.
            </>
          }
          subtitle="Platforma automātiski savieno brīvos šofierus ar piegādēm. Šoferis pieņem darbu lietotnē, saņem maršrutu un visu dokumentāciju digitāli."
          actions={
            <>
              <CTAButton href={`${APP_URL}/register?role=driver`} variant="primary" size="lg">
                Kļūt par šoferi
              </CTAButton>
              <CTAButton href={`${APP_URL}/register`} variant="secondary" size="lg">
                Reģistrēties kā uzņēmums
              </CTAButton>
            </>
          }
        >
          {/* Driver job card mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-foreground text-background">
              <span className="font-bold text-sm">Jauns darbs pieejams</span>
              <span className="font-mono text-xs opacity-60">B3-2854</span>
            </div>

            {/* Job details */}
            <div className="flex flex-col gap-5 p-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Materiāls</p>
                <p className="font-bold text-lg tracking-tight">Granīta šķembas 20–40</p>
                <p className="text-muted-foreground text-sm mt-0.5">22 tonnas</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Iekraušana</p>
                  <p className="font-medium text-xs leading-snug">Karjers "Liepa"</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ogre, Meža iela 5</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Piegāde</p>
                  <p className="font-medium text-xs leading-snug">SIA Latvijas Būve</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rīga, A. Kalniņa 12</p>
                </div>
              </div>

              <div className="flex gap-6 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Maršruts</p>
                  <p className="font-bold">38 km · ~48 min</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Samaksa</p>
                  <p className="font-bold text-foreground">€87.00</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Izpilde</p>
                  <p className="font-bold">Šodien, 14:00–17:00</p>
                </div>
              </div>
            </div>

            {/* Accept/Reject */}
            <div className="grid grid-cols-2 gap-0 border-t border-border">
              <button className="py-4 text-sm font-bold tracking-wide uppercase border-r border-border text-muted-foreground hover:bg-muted/20 transition-colors">
                Atteikt
              </button>
              <button className="py-4 text-sm font-bold tracking-wide uppercase bg-foreground text-background">
                Pieņemt darbu
              </button>
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc šoferi izvēlas B3Hub
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

        {/* Flow */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Šoferu maršruts platformā
            </p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Saņem push',
                  body: 'Jauns darbs pieejams — ar datiem par kravas, maršrutu un samaksu.',
                },
                {
                  step: '02',
                  title: 'Pieņem darbu',
                  body: 'Viena poga lietotnē. Platforma reservē piegādi uz šoferi.',
                },
                {
                  step: '03',
                  title: 'Brauc uz karjeru',
                  body: 'Navigācija iebūvēta. Karjers saņem paziņojumu par ierašanos.',
                },
                {
                  step: '04',
                  title: 'Iekraujas & piegādā',
                  body: 'Svars reģistrēts, dokuments sagatavots. Piegāde apstiprināta.',
                },
                {
                  step: '05',
                  title: 'Saņem izmaksu',
                  body: 'Samaksa rēķinā — nākamajā darba dienā automātiski.',
                },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="md:px-8 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-3"
                >
                  <span className="text-3xl font-bold tracking-tighter text-border">{step}</span>
                  <h3 className="text-base font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Stats */}
        <Container as="section" className="py-24 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              { value: '< 2 min', label: 'Laiks no piedāvājuma līdz pieņemšanai' },
              { value: '1 darba diena', label: 'Izmaksa pēc piegādes apstiprināšanas' },
              { value: '0', label: 'Dispečeru vai starppersonu nepieciešamība' },
            ].map(({ value, label }) => (
              <div key={label} className="md:px-12 first:pl-0 last:pr-0 py-8 md:py-0">
                <p className="text-5xl font-bold tracking-tighter leading-none">{value}</p>
                <p className="text-muted-foreground font-light mt-3 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* CTA */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Sāc braukt
              <br />
              ar B3Hub šodien.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`${APP_URL}/register?role=driver`} variant="inverted" size="lg">
                Reģistrēties kā šoferis
              </CTAButton>
              <p className="text-center text-background/40 text-sm">
                Bezmaksas, bez ikmēneša maksas
              </p>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
