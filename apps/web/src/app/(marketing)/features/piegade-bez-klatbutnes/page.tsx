import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Camera, Clock, ShieldCheck, FileText } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: Camera,
    title: 'Foto kā piegādes pierādījums',
    body: 'Šoferis fotografē izkrauto kravas pie galamērķa. Foto ar GPS atrašanās vietu un laika zīmogu automātiski saistīts ar pasūtījumu.',
  },
  {
    icon: Clock,
    title: 'Nav jāgaida šoferis',
    body: 'Nav nepieciešams būt klāt piegādes brīdī. Pircējs saņem push paziņojumu ar fotogrāfiju un piegādes apstiprinājumu uzreiz.',
  },
  {
    icon: ShieldCheck,
    title: 'Strīdi ar pierādījumiem',
    body: 'Ja rodas jautājumi par piegādi — foto, GPS un dokumenti ir platformā. Strīdu var iesniegt ar visiem pierādījumiem pievienotiem.',
  },
  {
    icon: FileText,
    title: 'Dokumenti ģenerējas automātiski',
    body: 'Pēc foto iesniegšanas platforma automātiski ģenerē svara zīmi un CMR. Nav nepieciešams saņēmēja paraksts uz papīra.',
  },
];

export default function PiegadeBezKlatbutnesPage() {
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
          eyebrow="Piegāde Bez Klātbūtnes"
          title={
            <>
              Krava piegādāta —
              <br />
              tu par to uzzini
              <br />
              uzreiz.
            </>
          }
          subtitle="Šoferis fotografē izkrauto kravas un iesniedz lietotnē. Tu saņem fotogrāfiju, GPS atrašanās vietu un piegādes apstiprinājumu — bez tālruņa zvana."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt izmantot
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-foreground text-background">
              <span className="font-bold text-sm">Krava piegādāta!</span>
              <span className="font-mono text-xs opacity-60">14:47</span>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="aspect-video bg-muted/40 border border-border flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="w-8 h-8" strokeWidth={1} />
                  <span className="text-xs">Piegādes foto · 14:47:03</span>
                  <span className="text-xs">GPS: Rīga, Bauskas iela 58</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-border p-3">
                  <p className="text-muted-foreground mb-1">Materiāls</p>
                  <p className="font-bold">Granīts 20/40 · 22t</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-muted-foreground mb-1">Šoferis</p>
                  <p className="font-bold">Jānis B. · LV·AB-1234</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <div className="h-10 bg-foreground/10 border border-border flex items-center justify-center">
                <span className="text-xs font-bold tracking-wide uppercase">
                  Lejupielādēt svara zīmi
                </span>
              </div>
            </div>
          </div>
        </Hero>

        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc tas ir ērti
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
              Kā piegāde bez klātbūtnes notiek
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Šoferis ierodas',
                  body: 'GPS atzīmē ierašanos. Lietotnē atveras piegādes apstiprināšanas ekrāns.',
                },
                {
                  step: '02',
                  title: 'Fotografē kravas',
                  body: 'Šoferis uzņem foto no izkrautās kravas ar lietotnē iebūvēto kameru.',
                },
                {
                  step: '03',
                  title: 'Iesniedz pierādījumu',
                  body: 'Foto ar GPS koordinātām un laika zīmogu tiek augšupielādēts platformā.',
                },
                {
                  step: '04',
                  title: 'Tu saņem paziņojumu',
                  body: 'Push paziņojums ar foto un apstiprinājumu. Dokumenti gatavi lejupielādei.',
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
              Nav jābūt klāt —
              <br />
              viss reģistrēts.
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
