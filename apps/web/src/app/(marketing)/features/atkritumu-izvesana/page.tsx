import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Trash2, MapPin, FileText, Recycle } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: Trash2,
    title: 'Konteineri pēc vajadzības',
    body: 'Pasūti konteineru (skip) tieši lietotnē. Izvēlies izmēru, norādi adresi un piegādes datumu — pārvadātājs apstiprina un piegādā.',
  },
  {
    icon: MapPin,
    title: 'Tuvākie pieņemšanas centri',
    body: 'Platforma rāda tuvākos atkritumu pieņemšanas un pārstrādes centrus ar pieejamajiem atkritumu veidiem un darba laiku.',
  },
  {
    icon: Recycle,
    title: 'Pārstrāde dokumentēta',
    body: 'Katram atkritumu transportam tiek ģenerēts dokuments ar materiāla veidu, daudzumu un pieņēmēja datiem. Viss saglabāts arhīvā.',
  },
  {
    icon: FileText,
    title: 'Atbilstība normatīviem',
    body: 'Būvniecības atkritumu dokumentācija atbilst Latvijas atkritumu apsaimniekošanas prasībām. Revīzijā vajadzīgie dokumenti ir pieejami uzreiz.',
  },
];

export default function AtkritumurIzvešanaPage() {
  return (
    <>
      <Navbar />
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
          eyebrow="Atkritumu Izvešana"
          title={
            <>
              Celtniecības
              <br />
              atkritumus —
              <br />
              ar vienu klikšķi.
            </>
          }
          subtitle="Pasūti konteineru vai organizē atkritumu transportu tieši platformā. Pieņemšanas centri, dokumenti un izsekošana — viss vienā vietā."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Pasūtīt konteineru
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="px-6 py-4 border-b border-border">
              <span className="font-bold">Konteinera pasūtījums</span>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { size: '4 m³', label: 'Mazais', active: false },
                  { size: '8 m³', label: 'Vidējais', active: true },
                  { size: '12 m³', label: 'Lielais', active: false },
                ].map(({ size, label, active }) => (
                  <div
                    key={size}
                    className={`border p-3 text-center ${active ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
                  >
                    <p className="font-bold text-sm">{size}</p>
                    <p
                      className={`text-xs mt-0.5 ${active ? 'text-background/60' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Piegādes adrese</p>
                <p className="font-medium text-xs">Rīga, Bauskas iela 58, būvlaukums</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Piegāde</p>
                  <p className="font-bold text-xs">Rītdien, 09:00</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Savākšana</p>
                  <p className="font-bold text-xs">Pēc 5 dienām</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Kopā ar piegādi</span>
                <span className="font-bold text-lg">€148.00</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <div className="h-10 bg-foreground flex items-center justify-center">
                <span className="text-xs font-bold tracking-wide uppercase text-background">
                  Apstiprināt pasūtījumu
                </span>
              </div>
            </div>
          </div>
        </Hero>

        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Ko piedāvā platforma
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
              No pasūtījuma līdz dokumentam
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Izvēlies konteineru',
                  body: 'Norādi izmēru, atkritumu veidu, adresi un piegādes datumu.',
                },
                {
                  step: '02',
                  title: 'Pārvadātājs apstiprina',
                  body: 'Tuvākais pieejamais pārvadātājs apstiprina pasūtījumu un piegādā konteineru.',
                },
                {
                  step: '03',
                  title: 'Piepilda un piesakās',
                  body: 'Kad konteiners pilns, platforma organizē savākšanu un transportu uz centru.',
                },
                {
                  step: '04',
                  title: 'Dokuments automātiski',
                  body: 'Atkritumu pieņemšanas dokuments tiek ģenerēts un pievienots arhīvam.',
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
              Sakārtots
              <br />
              būvlaukums.
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
