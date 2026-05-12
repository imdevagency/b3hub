import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { RoleTabs } from '@/components/marketing/layout/RoleTabs';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { HeroAddressSearch } from '@/components/marketing/HeroAddressSearch';
import { OrderServiceGrid } from '@/components/order/OrderServiceGrid';
import { ArrowRight, Check, FileText, MapPin, Banknote, Leaf } from 'lucide-react';
import Link from 'next/link';
import { CTAButton } from '@/components/marketing/ui/cta-button';

const AppIcon = ({ ios }: { ios: boolean }) =>
  ios ? (
    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current shrink-0" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current shrink-0" aria-hidden="true">
      <path d="M3.18 23.76c.3.17.66.19.99.04l13.2-7.62-2.84-2.84-11.35 10.42zM.5 1.51C.18 1.84 0 2.35 0 3.01v17.98c0 .66.18 1.17.5 1.5l.08.08 10.07-10.07v-.24L.58 1.43.5 1.51zM20.49 10.41l-2.86-1.65-3.18 3.18 3.18 3.17 2.88-1.66c.82-.47.82-1.56-.02-2.04zM3.18.24l13.2 7.62-2.84 2.84L2.19.28C2.52.13 2.88.07 3.18.24z" />
    </svg>
  );

export default function HomePage() {
  return (
    <main className="bg-white w-full overflow-hidden">
      {/* BRAND GRADIENT STRIP */}
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/50 to-foreground" />

      {/* ── 1. HERO ── */}
      <Hero
        align="center"
        eyebrow="B3Hub · Latvija"
        title={
          <>
            Digitālā platforma visai
            <br />
            <span className="text-[#999999]">celtniecības loģistikai</span>
          </>
        }
        subtitle="Izvēlieties izdevīgāko piedāvājumu būvmateriāliem, transportam un atkritumu konteineriem no licencētiem pakalpojumu sniedzējiem Latvijā."
        pricingNote="Pircējiem — bezmaksas. Piegādātājiem no 6%. Pārvadātājiem no 8%."
        actions={
          <div className="flex flex-col items-center gap-4 w-full mt-4">
            <HeroAddressSearch />
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mt-2"
            >
              Pārstāvat karjeru vai tehnikas parku?{' '}
              <span className="underline underline-offset-4">Reģistrēties partnerbāzē</span>{' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* ── 1.5 TRUST STRIP ── */}
      <section className="w-full border-b border-border bg-white">
        <Container className="py-8 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 text-muted-foreground/60">
          <p className="text-sm font-bold tracking-widest uppercase text-center">
            Mums uzticas vairāk nekā <span className="text-foreground/80">500+</span> partneru
          </p>
          <div className="hidden md:flex flex-wrap justify-center items-center gap-8 pointer-events-none select-none">
            <div className="text-lg font-black tracking-tighter">KARJERI</div>
            <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
            <div className="text-lg font-black tracking-tighter">BŪVUZŅĒMĒJI</div>
            <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
            <div className="text-lg font-black tracking-tighter">PĀRVADĀTĀJI</div>
            <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
            <div className="text-lg font-black tracking-tighter">POLIGONI</div>
          </div>
        </Container>
      </section>

      {/* ── 2. SERVICES GRID ── */}
      <section className="w-full bg-white">
        <Container className="py-24">
          <OrderServiceGrid />
        </Container>
      </section>

      {/* ── 3. PRICE ESTIMATOR (SPLIT LAYOUT) ── */}
      <section className="w-full bg-white py-16 md:py-24 border-t border-border">
        <Container className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="flex flex-col gap-6 max-w-xl">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Indikatīvais kalkulators
            </p>
            <h2 className="text-3xl md:text-5xl font-medium tracking-tighter leading-tight">
              Caurspīdīgas cenas.
              <br />
              Nekādu slēptu izmaksu.
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              B3Hub apvieno vadošos karjerus, transporta uzņēmumus un atkritumu pieņēmējus
              vienuviet. Pasūtiet visu nepieciešamo ar pāris klikšķiem tieši no piegādātājiem.
            </p>
            <ul className="flex flex-col gap-3 mt-2">
              {[
                'Cenas bez platformas uzcenojuma',
                'Plašs piedāvājums visā Latvijā',
                'Elektroniskas un drošas pavadzīmes',
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-base text-foreground font-medium"
                >
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-sm shrink-0">
              <PriceEstimator variant="card" />
            </div>
          </div>
        </Container>
      </section>

      {/* ── 4. WHO WE SERVE & MERGED HIGHLIGHTS ── */}
      <section id="uznemumiem" className="w-full bg-neutral-50 border-t border-border">
        <Container className="py-24 flex flex-col items-center text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
            Kas ir B3Hub
          </p>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight mb-4 max-w-2xl">
            Viena digitāla platforma
            <br />
            visai celtniecības loģistikai.
          </h2>
          <p className="text-lg text-muted-foreground font-light mb-16 max-w-xl">
            Pasūtiet materiālus, pārdodiet no karjera vai vediet kravas — platforma darbojas visām
            pusēm vienlaikus.
          </p>

          <RoleTabs />

          {/* Merged Highlights replacing "How it Works" & "Platform Highlights" */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
            {[
              {
                icon: MapPin,
                title: 'Atver katalogu un izseko piegādi',
                body: 'Cenas no reģionālajiem karjeriem redzamas uzreiz. Pēc pasūtījuma — pircējs un pārdevējs redz šoferi kartē reāllaikā.',
              },
              {
                icon: FileText,
                title: 'Automātiski dokumenti',
                body: 'Materiāli klāt! Svara zīme, CMR un PVN rēķins ģenerējas automātiski pēc katras piegādes. Juridiski derīgi, arhīvā 5 gadus.',
              },
              {
                icon: Banknote,
                title: 'Apmaksa nākamajā dienā',
                body: 'Šoferi un piegādātāji saņem izmaksu garantēti. Nav jāgaida garie pēcapmaksas termiņi vai manuāli jāsaskaņo rēķini.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white border border-border rounded-3xl p-8 flex flex-col gap-6 shadow-sm"
              >
                <div className="p-4 bg-neutral-50 w-fit rounded-2xl border border-border">
                  <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight mb-3">{title}</h3>
                  <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 5. SLIM PRICING TEASER ── */}
      <section className="w-full bg-white border-t border-border">
        <Container className="py-16 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div>
            <h3 className="text-2xl font-medium tracking-tight mb-2">Maksa tikai par rezultātu</h3>
            <p className="text-muted-foreground font-light max-w-xl">
              Pircējiem platforma ir pilnīgi <strong>bez maksas</strong>. Piegādātājiem un
              pārvadātājiem komisija no <strong>6% līdz 8%</strong> tikai par apmaksātiem
              pasūtījumiem.
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex items-center text-sm font-semibold tracking-wide gap-2 bg-neutral-100 hover:bg-neutral-200 text-foreground px-6 py-3 rounded-full transition-colors shrink-0"
          >
            Skatīt pilnu cenrādi <ArrowRight className="w-4 h-4" />
          </Link>
        </Container>
      </section>

      {/* ── 6. FINAL CTA & APP BADGES ── */}
      <section className="w-full py-24 md:py-32 bg-[#203728] text-white">
        <Container className="flex flex-col md:flex-row items-center justify-between gap-16 md:gap-12">
          <div className="text-center md:text-left">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none mb-8 text-white">
              Viss būvlaukumam —
              <br />
              <span className="text-[#4ade80]">vienuviet.</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <CTAButton
                href={'/order'}
                variant="inverted"
                size="lg"
                className="w-full sm:w-auto bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-none"
              >
                Pasūtīt tagad <ArrowRight className="w-5 h-5 ml-2" />
              </CTAButton>
              <CTAButton
                href={'/register'}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border border-white/20 text-white bg-transparent hover:bg-white/10 shadow-none"
              >
                Kļūt par partneri
              </CTAButton>
            </div>
            <p className="text-white/40 text-sm mt-6 hidden md:block">
              Privātpersonām — pasūtīšana bez reģistrācijas
            </p>
          </div>

          {/* App badges in CTA */}
          <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-12 md:pt-0 md:pl-16 text-center md:text-left">
            <p className="text-sm font-bold tracking-widest uppercase text-white/40">
              Mobilā aplikācija
            </p>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
              <div className="inline-flex items-center justify-center md:justify-start gap-3 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-full transition-colors cursor-pointer w-full">
                <AppIcon ios={true} />
                <div className="flex flex-col leading-tight text-left">
                  <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider">
                    Lejupielādēt
                  </span>
                  <span className="text-sm font-semibold text-white">App Store</span>
                </div>
              </div>
              <div className="inline-flex items-center justify-center md:justify-start gap-3 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-full transition-colors cursor-pointer w-full">
                <AppIcon ios={false} />
                <div className="flex flex-col leading-tight text-left">
                  <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider">
                    Lejupielādēt
                  </span>
                  <span className="text-sm font-semibold text-white">Google Play</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
