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
  X,
  ArrowRight,
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
                  <div className="p-3 bg-background shrink-0 w-fit rounded-full shadow-xs">
                    <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-bold tracking-tight uppercase leading-snug">
                    {title}
                  </span>
                </>
              );
              const cls =
                'flex items-center gap-5 bg-secondary/30 rounded-3xl p-6 transition-all border border-transparent';
              return slug ? (
                <Link
                  key={title}
                  href={`/features/${slug}`}
                  className={`${cls} hover:bg-secondary/50 hover:shadow-sm`}
                >
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
        <section className="w-full border-t border-border bg-background">
          <Container className="py-24 md:py-32">
            <div className="flex flex-col gap-12">
              <div>
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                  Salīdzinājums
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-none">
                  Kāpēc pārslēgties uz
                  <br />
                  B3Hub platformu?
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  {
                    old: 'Zvani karjeriem, lai noskaidrotu cenas',
                    new: 'Cenas katalogā — uzreiz un caurspīdīgi',
                  },
                  {
                    old: 'WhatsApp grupas, lai sekotu piegādei',
                    new: 'Reāllaika GPS lietotnē ar paziņojumiem',
                  },
                  { old: 'Papīra svara zīmes un CMR', new: 'Dokumenti ģenerējas automātiski' },
                  {
                    old: 'Rēķini no 10 dažādiem piegādātājiem',
                    new: 'Viens konsolidēts rēķins mēnesī',
                  },
                  {
                    old: 'Excel, lai apkopotu projektus',
                    new: 'Projekti ar apjomu kontroli platformā',
                  },
                  {
                    old: 'Dispečera zvans katram šoferim',
                    new: 'Darbi tiek nosūtīti šoferim automātiski',
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col md:flex-row md:items-center gap-6 bg-secondary/30 rounded-3xl p-6 md:px-8 md:py-8 transition-all hover:bg-secondary/50 hover:shadow-sm"
                  >
                    <div className="flex-1 flex gap-4 text-muted-foreground opacity-60">
                      <X className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} />
                      <span className="line-through decoration-1 text-lg font-light">
                        {item.old}
                      </span>
                    </div>
                    <ArrowRight className="hidden md:block w-6 h-6 shrink-0 text-muted-foreground/30" />
                    <div className="flex-1 flex gap-4 text-foreground">
                      <div className="p-1 bg-background self-start rounded-full shrink-0 shadow-xs">
                        <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                      </div>
                      <span className="text-lg font-medium">{item.new}</span>
                    </div>
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
