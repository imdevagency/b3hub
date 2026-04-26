import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Award, Download, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: Award,
    title: 'Sertifikāti pie katra materiāla',
    body: 'Piegādātāji pievieno kvalitātes sertifikātus (CE, EN, LVS) tieši pie sava materiāla katalogā. Pircējs tos var apskatīt pirms pasūtīšanas.',
  },
  {
    icon: Download,
    title: 'Lejupielāde vienā klikšķī',
    body: 'Sertifikātu PDF lejupielādē tieši no pasūtījuma kopskata vai no piegādātāja profila. Nav jāraksta e-pasts un jāgaida atbilde.',
  },
  {
    icon: FileText,
    title: 'Piesaistīti piegādei',
    body: 'Katrs sertifikāts ir saistīts ar konkrētu piegādi. Objekta pieņemšanas komisija var pārbaudīt materiālu atbilstību tieši platformā.',
  },
  {
    icon: ShieldCheck,
    title: 'Verificēti piegādātāji',
    body: 'Platforma pārbauda, ka augšupielādētie sertifikāti ir derīgi un neatjaunoti. Dokumenti ar beidzies derīguma termiņu tiek atzīmēti.',
  },
];

export default function SertifikatiPage() {
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
          eyebrow="Kvalitātes Sertifikāti"
          title={
            <>
              Materiālu
              <br />
              kvalitāte —
              <br />
              dokumentēta.
            </>
          }
          subtitle="Katrs pasūtītais materiāls nāk ar pievienotiem kvalitātes sertifikātiem. Lejupielādē PDF tieši no piegādes — pieņemšanas komisija var pārbaudīt uzreiz."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt izmantot
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <span className="font-bold">Sertifikāti · Piegāde B3-2854</span>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {[
                {
                  name: 'CE sertifikāts · Granīts 20/40',
                  issuer: 'LVS EN 13242:2020',
                  valid: 'Derīgs līdz 2026-12',
                  ok: true,
                },
                {
                  name: 'Testēšanas protokols',
                  issuer: 'VSIA "Būvniecības laboratorija"',
                  valid: 'Izsniegts 2025-08',
                  ok: true,
                },
                {
                  name: 'Izcelsmes deklarācija',
                  issuer: 'Karjers "Liepa" SIA',
                  valid: 'Derīgs',
                  ok: true,
                },
              ].map(({ name, issuer, valid, ok }) => (
                <div key={name} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-bold text-xs">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{issuer}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${ok ? 'text-foreground' : 'text-red-500'}`}>
                      {valid}
                    </span>
                    <span className="text-xs font-bold underline cursor-pointer">PDF</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border">
              <div className="h-9 bg-foreground flex items-center justify-center">
                <span className="text-xs font-bold tracking-wide uppercase text-background">
                  Lejupielādēt visus
                </span>
              </div>
            </div>
          </div>
        </Hero>

        <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc sertifikāti platformā
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
              Kā sertifikāti nonāk pie tevis
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Piegādātājs augšupielādē',
                  body: 'Karjers vai piegādātājs pievieno sertifikātus savam materiālu profilā.',
                },
                {
                  step: '02',
                  title: 'Saistīts ar piegādi',
                  body: 'Pasūtot materiālu, attiecīgie sertifikāti automātiski tiek pievienoti pasūtījumam.',
                },
                {
                  step: '03',
                  title: 'Piegāde apstiprināta',
                  body: 'Pēc piegādes visi dokumenti, ieskaitot sertifikātus, pieejami no piegādes kopskata.',
                },
                {
                  step: '04',
                  title: 'Lejupielādē PDF',
                  body: 'Viens klikšķis — sertifikātu pakete lejupielādēta. Pieņemšanas komisijai gatava.',
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
              Kvalitāte
              <br />
              apliecināta.
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
