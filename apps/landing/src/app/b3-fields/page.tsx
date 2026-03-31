import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { ArrowRight, Package, Recycle, Truck, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { CTAButton } from '@/components/ui/cta-button';

export const metadata: Metadata = {
  title: 'B3 Fields — Fiziskie loģistikas punkti Latvijā | B3Hub',
  description:
    'Paņem celtniecības materiālus, nodod atkritumus ar juridiski derīgu sertifikātu un īrē piekabes 6 punktos visā Latvijā. Viss caur B3Hub platformu.',
  openGraph: {
    title: 'B3 Fields — Fiziskie loģistikas punkti Latvijā',
    description:
      'Materiālu paņemšana, atkritumu nodošana un piekabju noma. 6 punkti. Dokumenti automātiski.',
    url: 'https://b3hub.lv/b3-fields',
    siteName: 'B3Hub',
    locale: 'lv_LV',
    type: 'website',
  },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Package,
    title: 'Materiālu paņemšana',
    body: 'Nopērciet materiālu platformā un paņemiet to ar savu auto. Ideāli māju saimniekiem — bez piegādes izmaksām.',
    badge: 'Pieejams visās 6 vietās',
    features: ['Digitāls čeks uzreiz', 'Nav minimālā pasūtijuma'],
  },
  {
    icon: Recycle,
    title: 'Atkritumu nodošana',
    body: 'Celtniecības atkritumu izvešana bez reģistrācijas var izmaksāt līdz €5 000 naudas soda. B3 Field ģenerē juridiski derīgu sertifikātu automātiski — uz vietas.',
    badge: 'ES Direktīva 2008/98/EK',
    features: ['Sertifikāts < 30 sekundēs', 'Arhīvs platformā 5 gadus'],
  },
  {
    icon: Truck,
    title: 'Piekabe īrei',
    body: 'Maziem pasūtījumiem, kad liels kravas auto nav vajadzīgs. Iznomājiet uz vietas, atgrieziet jebkurā B3 Field punktā Latvijā.',
    badge: 'No €25 / dienā',
    features: ['Atgriešana jebkurā punktā', 'Piesaistīts pasūtijumam automātiski'],
  },
];

const locations = [
  { city: 'Rīga', address: 'Maskavas iela 300', services: ['Paņemšana', 'Atkritumi', 'Piekabe'] },
  { city: 'Jelgava', address: 'Rūpniecības iela 45', services: ['Paņemšana', 'Atkritumi'] },
  { city: 'Liepāja', address: 'Klaipēdas šoseja 12', services: ['Paņemšana', 'Piekabe'] },
  { city: 'Valmiera', address: 'Rīgas iela 78', services: ['Paņemšana', 'Atkritumi', 'Piekabe'] },
  { city: 'Jēkabpils', address: 'Brīvības iela 34', services: ['Paņemšana'] },
  { city: 'Daugavpils', address: 'Varoņu iela 9', services: ['Paņemšana', 'Atkritumi'] },
];

export default function B3FieldsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground w-full overflow-hidden">
        {/* ── HERO ── */}
        <Hero
          eyebrow="B3 Fields"
          title={
            <>
              Fiziski punkti.
              <br />
              Digitāli
              <br />
              darījumi.
            </>
          }
          subtitle="Paņem materiālus vai nodod atkritumus ar juridiski derīgu sertifikātu. Viss vienā lietotnē."
          actions={
            <>
              <CTAButton href={`${APP_URL}/locations`} variant="primary" size="lg">
                Apskatīt lokācijas
              </CTAButton>
              <CTAButton href={`${APP_URL}/register`} variant="outline" size="lg">
                Reģistrēties
              </CTAButton>
            </>
          }
        ></Hero>

        {/* ── LOCATIONS ── */}
        <Container as="section" id="locations" className="py-32 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                B3 Tīkls
              </p>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tighter leading-none">
                6 punkti.
                <br />
                Visā Latvijā.
              </h2>
            </div>
            <div className="flex flex-col gap-2 md:text-right">
              <p className="text-muted-foreground font-light text-sm">
                Jaunas vietas gaidāmas 2026. gadā.
              </p>
              <p className="text-muted-foreground font-light text-sm">
                P–Pk 07:00–19:00 · Sest 08:00–16:00
              </p>
            </div>
          </div>
          <div className="flex flex-col border-t border-border">
            {locations.map(({ city, address, services: svc }) => (
              <div
                key={city}
                className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4 border-b border-border"
              >
                <div className="flex items-baseline gap-8 min-w-0">
                  <h3 className="text-3xl font-medium tracking-tight shrink-0">{city}</h3>
                  <p className="text-muted-foreground font-light text-lg truncate">{address}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap md:justify-end shrink-0">
                  {svc.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-bold tracking-widest uppercase bg-muted text-foreground px-3 py-1.5"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
                  q: 'Vai jāreģistrējas, lai izmantotu B3 Field?',
                  a: 'Jā — reģistrācija ir bezmaksas un aizņem < 2 minūtes. Nepieciešama rezervācijai un dokumentu saņemšanai.',
                },
                {
                  q: 'Kādus maksājumus pieņemat?',
                  a: 'Maksājums notiek caur platformu pirms ierašanās — ar bankas karti vai pārskaitījumu. Skaidra nauda nav pieņemta.',
                },
                {
                  q: 'Vai atkritumu sertifikāts ir juridiski derīgs?',
                  a: 'Jā. Sertifikāts atbilst ES Direktīvai 2008/98/EK un Latvijas normatīvajiem aktiem. Pieejams platformā bez termiņa.',
                },
                {
                  q: 'Vai piekabe jāatgriež tajā pašā vietā?',
                  a: 'Nē. Piekabi var atgriezt jebkurā no 6 B3 Field punktiem visā Latvijā. Platforma atgriešanu apstrādā automātiski.',
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
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col items-center justify-center text-center gap-8">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-background leading-none">
              Sāc jau šodien.
            </h2>
            <p className="text-xl text-background/50 font-light max-w-md">
              Reģistrācija bezmaksas. Pirmā vizīte bez gaidīšanas.
            </p>
            <div className="flex flex-col items-center gap-4 mt-4">
              <CTAButton href={`${APP_URL}/register`} variant="inverted" size="lg">
                Izveidot bezmaksas kontu
              </CTAButton>
              <Link
                href="/contact"
                className="text-background/40 text-sm hover:text-background/70 transition-colors"
              >
                Vai sazinieties ar mums →
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
