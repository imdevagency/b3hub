import React from 'react';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import {
  SlidersHorizontal,
  Lock,
  ArrowLeftRight,
  Navigation,
  Car,
  Contact,
  FolderKanban,
  Trash2,
  Package,
  Building2,
  ShieldCheck,
  MessageSquare,
  Truck,
  FileText,
  LayoutList,
  Camera,
  Award,
  Check,
} from 'lucide-react';
import Link from 'next/link';


const features: { icon: React.ElementType; slug: string | null; title: string }[] = [
  { icon: SlidersHorizontal, slug: 'meklesanas-radiuss', title: 'Meklēšanas rādiuss pasūtījumiem' },
  { icon: Lock, slug: 'atlauju-parvaldiba', title: 'Atļauju pārvaldība' },
  {
    icon: ArrowLeftRight,
    slug: 'atgriesanas-braucieni',
    title: 'Atgriešanās braucienu optimizācija',
  },
  { icon: Navigation, slug: 'gps-izsekosana', title: 'Vienkārša maršruta plānošana' },
  { icon: Car, slug: 'transportlidzekli', title: 'Transportlīdzekļu pārvaldība' },
  { icon: Contact, slug: 'kontakti', title: 'Visi kontakti vienā vietā' },
  { icon: FolderKanban, slug: 'projekti', title: 'Projekti ar fiksētiem apjomiem' },
  { icon: Trash2, slug: 'atkritumu-izvesana', title: 'Celtniecības atkritumu izvešana' },
  { icon: Package, slug: 'katalogs', title: 'Visi celtniecības materiāli' },
  { icon: Building2, slug: 'uznemuma-konts', title: 'Viens konts visiem projektiem' },
  { icon: ShieldCheck, slug: 'piegades-verificacija', title: 'Fiktīva piegāde nav iespējama' },
  { icon: MessageSquare, slug: 'rfq', title: 'Vienkāršākā cenu salīdzināšana' },
  { icon: Truck, slug: 'dispets', title: 'Pārvadātāju tīkls Latvijā' },
  { icon: FileText, slug: 'dokumenti', title: 'Digitālie dokumenti' },
  { icon: LayoutList, slug: 'pasutijumu-parskats', title: 'Visi pasūtījumi pārskatā' },
  { icon: Camera, slug: 'piegade-bez-klatbutnes', title: 'Piegāde bez klātbūtnes' },
  { icon: Award, slug: 'sertifikati', title: 'Sertifikātu augšupielāde' },
];

export default function FeaturesPage() {
  return (
    <>
      <main className="bg-background w-full overflow-hidden">
        {/* ── HERO ── */}
        <section className="pt-40 pb-24 md:pt-48 md:pb-32 border-b border-border">
          <Container>
            <div className="flex flex-col gap-10 max-w-3xl">
              <div className="flex items-center gap-4">
                <div className="h-0.5 w-12 bg-foreground" />
                <span className="text-sm font-bold tracking-widest uppercase">Platforma</span>
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-[5rem] font-bold tracking-tighter leading-[0.95]">
                Viss vienā
                <br />
                platformā.
              </h1>
              <p className="text-xl text-muted-foreground font-light max-w-xl leading-relaxed">
                B3Hub digitalizē katru soli — no materiālu kataloga līdz automātiskajiem
                dokumentiem. Visi moduļi strādā kopā nevainojami.
              </p>
              <div className="flex flex-wrap gap-4">
                <CTAButton href={`/register`} variant="primary" size="lg">
                  Izmēģināt bez maksas
                </CTAButton>
                <CTAButton href="/pricing" variant="secondary" size="lg">
                  Skatīt cenas
                </CTAButton>
              </div>
            </div>
          </Container>
        </section>

        {/* ── FEATURE GRID ── */}
        <Container as="section" className="py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map(({ icon: Icon, slug, title }) => {
              const inner = (
                <>
                  <Icon className="w-8 h-8 shrink-0 text-foreground" strokeWidth={1.25} />
                  <span className="text-sm font-bold tracking-tight uppercase leading-snug">
                    {title}
                  </span>
                </>
              );
              const cls =
                'flex items-center gap-5 bg-muted/30 border border-border px-6 py-6 transition-colors';
              return slug ? (
                <Link key={title} href={`/features/${slug}`} className={`${cls} hover:bg-muted/60`}>
                  {inner}
                </Link>
              ) : (
                <div key={title} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        </Container>

        {/* ── COMPARE SECTION ── */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Vecā metode vs B3Hub
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-border">
              <div className="flex flex-col gap-4 md:pr-16 pb-12 md:pb-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Pirms B3Hub
                </p>
                {[
                  'Zvani karjeriem, lai noskaidrotu cenas',
                  'WhatsApp grupas, lai sekotu piegādei',
                  'Papīra svara zīmes un CMR',
                  'Rēķini no 10 dažādiem piegādātājiem',
                  'Excel, lai apkopotu projektus',
                  'Dispečera zvans katram šoferim',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                    <span className="font-light">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4 md:pl-16 pt-12 md:pt-0">
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  Ar B3Hub
                </p>
                {[
                  'Cenas katalogā — uzreiz un caurspīdīgi',
                  'Reāllaika GPS lietotnē ar paziņojumiem',
                  'Dokumenti ģenerējas automātiski',
                  'Viens konsolidēts rēķins mēnesī',
                  'Projekti ar apjomu kontroli platformā',
                  'Darbi tiek nosūtīti šoferim automātiski',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-foreground" strokeWidth={2.5} />
                    <span className="font-light">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-background leading-none">
              Gatavs izmēģināt
              <br />
              pilnu platformu?
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Sākt bez maksas
              </CTAButton>
              <p className="text-center text-background/40 text-sm">Nav nepieciešama kredītkarte</p>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
