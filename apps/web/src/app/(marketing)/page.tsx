import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { RoleTabs } from '@/components/marketing/layout/RoleTabs';
import {
  ArrowRight,
  Truck,
  Pickaxe,
  Check,
  Home,
  Building2,
  FileText,
  MapPin,
  Banknote,
} from 'lucide-react';
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
    <main className="bg-background w-full overflow-hidden">
      {/* BRAND GRADIENT STRIP */}
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/50 to-foreground" />

      {/* ── 1. HERO ── */}
      <Hero
        eyebrow="Latvija · Baltija"
        title={
          <>
            Materiāli.
            <br />
            Transports.
            <br />
            Dokumenti.
          </>
        }
        subtitle="Digitālā platforma, kas savieno karjerus, pārvadātājus un būvniekus — no pasūtījuma līdz rēķinam, automātiski."
        pricingNote="Pircējiem — bezmaksas. Piegādātājiem no 6%. Pārvadātājiem no 8%."
        actions={
          <>
            <CTAButton href={'/order'} variant="primary" size="lg">
              Pasūtīt tagad <ArrowRight className="w-5 h-5 ml-2" />
            </CTAButton>
            <CTAButton href={'#uznemumiem'} variant="secondary" size="lg">
              Uzzināt vairāk →
            </CTAButton>
          </>
        }
      >
        <div className="w-full h-125 md:h-187.5 bg-muted relative overflow-hidden self-center rounded-2xl md:rounded-3xl border border-border shadow-2xl">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888086925-920a0b4111eb?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center grayscale-[0.8] contrast-125 hover:scale-105 transition-transform duration-[4s] z-0" />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent z-10" />
        </div>
      </Hero>

      {/* ── 2. WHO WE SERVE — B2C / B2B / Driver / Supplier merged ── */}
      <section id="uznemumiem" className="w-full bg-neutral-50">
        <Container className="py-24 flex flex-col items-center text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
            Kas ir B3Hub
          </p>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight mb-4 max-w-2xl">
            Viens digitāls marķetpleiss
            <br />
            visai celtniecības loģistikai.
          </h2>
          <p className="text-lg text-muted-foreground font-light mb-16 max-w-xl">
            Pasūtiet materiālus, pārdodiet no karjera vai vediet kravas — platforma darbojas visām
            trim pusēm vienlaikus.
          </p>

          <RoleTabs />
        </Container>
      </section>

      {/* ── 3. HOW IT WORKS ── */}
      <section className="w-full bg-background">
        <Container className="py-32">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kā tas strādā
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              {
                step: '01',
                title: 'Atver katalogu — cenas uzreiz',
                body: 'Izvēlies materiālu, norādi apjomu un piegādes vietu. Cenas no reģionālajiem karjeriem — redzamas uzreiz, bez zvaniem, bez e-pastiem.',
              },
              {
                step: '02',
                title: 'Platforma saskaņo karjeru un šoferi',
                body: 'Piegādātājs apstiprina iekraušanu. Tuvākais brīvais šoferis saņem maršrutu automātiski. Abas puses izseko piegādi reāllaikā.',
              },
              {
                step: '03',
                title: 'Dokumenti ģenerējas — bez jūsu darba',
                body: 'Svara zīme, CMR un PVN rēķins tiek sagatavoti automātiski pēc piegādes apstiprināšanas. Juridiski derīgi un arhīvā 5 gadus.',
              },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="md:px-12 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-6"
              >
                <span className="text-5xl font-medium tracking-tighter text-border">{step}</span>
                <h3 className="text-2xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 4. PLATFORM HIGHLIGHTS (replaces fake testimonials) ── */}
      <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kāpēc B3Hub
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: 'Nav vairāk papīra dokumentu',
                body: 'Svara zīme, CMR un PVN rēķins ģenerējas automātiski pēc katras piegādes. Juridiski derīgi, arhīvā 5 gadus — bez manuāla darba.',
              },
              {
                icon: MapPin,
                title: 'Zini, kur auto atrodas',
                body: 'No iekraušanas brīža līdz ierašanās vietai — pircējs un karjers redz šoferi kartē reāllaikā. Nekad vairāk jautājums "kad atnāks?"',
              },
              {
                icon: Banknote,
                title: 'Nauda nākamajā dienā',
                body: 'Šoferi saņem izmaksu nākamajā darba dienā pēc katras piegādes automātiski. Nav rēķinu gaidīšanas, nav kavēšanās, nav pārsteigumu.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-secondary/30 rounded-3xl p-10 flex flex-col gap-6">
                <div className="p-4 bg-background w-fit rounded-full shadow-xs">
                  <Icon className="w-8 h-8 text-foreground" strokeWidth={1.5} />
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

      {/* ── 5. PRICING TEASER ── */}
      <section className="w-full bg-background">
        <Container className="py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">
                Cenas
              </p>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-none">
                Maksā tikai
                <br />
                par rezultātu.
              </h2>
            </div>
            <Link
              href="/pricing"
              className="flex items-center text-sm font-bold tracking-wide uppercase gap-2 hover:gap-3 transition-all shrink-0"
            >
              Skatīt pilnas cenas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              {
                role: 'Pircējs',
                price: '0%',
                note: 'Pilnīgi bez maksas.',
                items: [
                  'Neierobežoti pasūtījumi',
                  'Reāllaika piegāžu izsekošana',
                  'Digitālie piegādes dokumenti',
                ],
              },
              {
                role: 'Piegādātājs / Karjers',
                price: '6%',
                note: 'no katras pasūtījuma vērtības.',
                items: [
                  'Neierobežoti materiālu ieraksti',
                  'Automātiskie rēķini un dokumenti',
                  'Analītika un pārdošanas pārskati',
                ],
                featured: true,
              },
              {
                role: 'Pārvadātājs / Šoferis',
                price: '8%',
                note: 'no katras piegādes vērtības.',
                items: [
                  'Izmaksa nākamajā darba dienā',
                  'Darbu izvēle bez saistībām',
                  'Digitālie pavadraksti',
                ],
              },
            ].map(({ role, price, note, items, featured }) => (
              <div
                key={role}
                className={`md:px-12 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-6 ${
                  featured ? 'md:relative' : ''
                }`}
              >
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
                    {role}
                  </p>
                  <p className="text-5xl font-medium tracking-tighter leading-none">{price}</p>
                  <p className="text-sm text-muted-foreground mt-2 font-light">{note}</p>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-4 h-4 shrink-0 text-foreground" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 6. STATS + APP DOWNLOAD ── */}
      <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-16">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-0 sm:divide-x divide-border flex-1">
              {[
                { value: '100%', label: 'Piegādes dokumenti ģenerējas automātiski' },
                { value: '€0', label: 'Komisija pircējiem — pasūtīšana bezmaksas' },
                { value: '1 DG', label: 'Šoferu izmaksa pēc katras piegādes' },
              ].map(({ value, label }) => (
                <div key={label} className="sm:px-12 first:pl-0 last:pr-0">
                  <p className="text-6xl md:text-7xl font-medium tracking-tighter leading-none">
                    {value}
                  </p>
                  <p className="text-lg text-muted-foreground mt-3 font-light tracking-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* App badges — styled, not linked until app launches */}
            <div className="flex flex-col gap-4 lg:border-l lg:border-border lg:pl-16">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Mobilā aplikācija
              </p>
              <p className="text-base text-muted-foreground font-light max-w-xs">
                iOS un Android. Pieejama drīzumā.
              </p>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 mt-2">
                <div
                  className="inline-flex items-center gap-3 bg-foreground text-background px-5 py-3.5 rounded-full w-fit"
                  aria-label="App Store"
                >
                  <AppIcon ios={true} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-background/50 text-xs">Lejupielādēt</span>
                    <span className="text-sm font-semibold">App Store</span>
                  </div>
                </div>
                <div
                  className="inline-flex items-center gap-3 bg-foreground text-background px-5 py-3.5 rounded-full w-fit"
                  aria-label="Google Play"
                >
                  <AppIcon ios={false} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-background/50 text-xs">Lejupielādēt</span>
                    <span className="text-sm font-semibold">Google Play</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── 7. FINAL CTA ── */}
      <section className="w-full py-32 bg-foreground">
        <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
          <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-none">
            Viss būvlaukumam —
            <br />
            vienuviet.
          </h2>
          <div className="flex flex-col gap-4 min-w-fit">
            <CTAButton href={'/order'} variant="inverted" size="lg">
              Pasūtīt tagad <ArrowRight className="w-5 h-5 ml-2" />
            </CTAButton>
            <CTAButton
              href={'/register'}
              variant="outline"
              size="lg"
              className="border-background/20 text-background hover:border-background/60"
            >
              Reģistrēt uzņēmumu
            </CTAButton>
            <p className="text-center text-background/40 text-sm">
              Privātpersonām — bez reģistrācijas
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
