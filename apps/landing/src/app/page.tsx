import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { ArrowRight, Truck, HardHat, Pickaxe } from 'lucide-react';
import Link from 'next/link';
import { CTAButton } from '@/components/ui/cta-button';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

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
    <>
      <Navbar />
      <main className="bg-background w-full overflow-hidden">
        {/* ── 1. HERO ── */}
        <Hero
          eyebrow="Latvija & Baltija"
          title={
            <>
              Pasūti.
              <br />
              Piegādā.
              <br />
              Dokumentē.
            </>
          }
          subtitle="B3Hub savieno būvniekus, grants karjerus un kravas auto vienā digitālā platformā — no pasūtījuma līdz parakstītam piegādes aktam."
          actions={
            <>
              <CTAButton href={`${APP_URL}/register`} variant="primary" size="lg">
                Sākt bez maksas <ArrowRight className="w-5 h-5 ml-2" />
              </CTAButton>
              <CTAButton href={`${APP_URL}/register?role=driver`} variant="secondary" size="lg">
                Kļūt par šoferi
              </CTAButton>
            </>
          }
        >
          <div className="w-full h-125 md:h-187.5 bg-muted relative overflow-hidden self-center">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888086925-920a0b4111eb?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center grayscale contrast-125 hover:scale-105 transition-transform duration-[2s]" />
            <div className="absolute inset-0 bg-black/10" />
          </div>
        </Hero>

        {/* ── 2. WHO IS THIS FOR ── */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kas izmanto B3Hub
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Buyers */}
            <div className="border border-border p-10 flex flex-col gap-8 justify-between group hover:border-foreground/30 transition-colors">
              <HardHat className="w-10 h-10 text-foreground" strokeWidth={1.5} />
              <div className="flex flex-col gap-4">
                <h3 className="text-2xl font-medium tracking-tight">Būvnieki & Pasūtītāji</h3>
                <p className="text-muted-foreground font-light leading-relaxed">
                  Pasūti materiālus un atkritumu izvešanu vienā ekrānā. Reāllaika izsekošana,
                  automātiskie akti un rēķini bez manuāla darba.
                </p>
                <Link
                  href="/buvniekiem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase gap-2 group-hover:gap-3 transition-all mt-2"
                >
                  Uzzināt vairāk <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Drivers — inverted */}
            <div className="bg-foreground text-background p-10 flex flex-col gap-8 justify-between">
              <Truck className="w-10 h-10 text-background/50" strokeWidth={1.5} />
              <div className="flex flex-col gap-4">
                <h3 className="text-2xl font-medium tracking-tight">Šoferi & Pārvadātāji</h3>
                <p className="text-background/60 font-light leading-relaxed">
                  Saņem maršrutus tieši telefonā. Pārskats par paveiktajiem reisiem, izpeļņu un
                  dokumentiem — bez papīriem un zvaniem dispečeram.
                </p>
                <Link
                  href="/parvadatajiem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase text-background gap-2 hover:gap-3 transition-all mt-2"
                >
                  Sākt braukt <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Suppliers */}
            <div className="border border-border p-10 flex flex-col gap-8 justify-between group hover:border-foreground/30 transition-colors">
              <Pickaxe className="w-10 h-10 text-foreground" strokeWidth={1.5} />
              <div className="flex flex-col gap-4">
                <h3 className="text-2xl font-medium tracking-tight">Karjeri & Piegādātāji</h3>
                <p className="text-muted-foreground font-light leading-relaxed">
                  Saņem pasūtījumus automātiski. Nav jātērē laiks telefoniem — klients atrod tevi
                  katalogā un cena ir noteikta iepriekš.
                </p>
                <Link
                  href="/karjeriem"
                  className="flex items-center text-sm font-bold tracking-wide uppercase gap-2 group-hover:gap-3 transition-all mt-2"
                >
                  Pievienoties tīklam <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </Container>

        {/* ── 3. HOW IT WORKS ── */}
        <Container as="section" className="py-32 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-16">
            Kā tas strādā
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
            {[
              {
                step: '01',
                title: 'Pievieno pasūtījumu',
                body: 'Izvēlies materiālu no kataloga, norādi piegādes vietu un daudzumu. Cenas redzamas uzreiz — bez zvaniem vai e-pastiem.',
              },
              {
                step: '02',
                title: 'Karjers apstiprina & šoferis brauc',
                body: 'Piegādātājs apstiprina iekraušanu. Tuvākais brīvais šoferis saņem maršrutu. GPS izsekošana reāllaikā abām pusēm.',
              },
              {
                step: '03',
                title: 'Piegāde & automātiskie dokumenti',
                body: 'Pēc piegādes platforma ģenerē svara zīmi, CMR un rēķinu. Visi dokumenti arhīvā — juridiski derīgi, pieejami 5 gadus.',
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

        {/* ── 4. TRUST — stats + app download ── */}
        <section className="w-full border-t border-border">
          <Container className="py-24">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-16">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-0 sm:divide-x divide-border flex-1">
                {[
                  { value: '1.5M+', label: 'Pārvietotās tonnas' },
                  { value: '240+', label: 'Aktīvie transportlīdzekļi' },
                  { value: '48h', label: 'Vidējais pirmā pasūtījuma laiks' },
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

              {/* App badges */}
              <div className="flex flex-col gap-4 lg:border-l lg:border-border lg:pl-16">
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                  Mobilā aplikācija
                </p>
                <p className="text-base text-muted-foreground font-light max-w-xs">
                  Pieejama iOS un Android. Bezmaksas šoferiem un pasūtītājiem.
                </p>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 mt-2">
                  <a
                    href="https://apps.apple.com/app/b3hub"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-foreground text-background hover:bg-foreground/90 transition-colors px-5 py-3.5"
                    aria-label="Lejupielādēt App Store"
                  >
                    <AppIcon ios={true} />
                    <div className="flex flex-col leading-tight">
                      <span className="text-background/50 text-xs">Lejupielādēt</span>
                      <span className="text-sm font-medium">App Store</span>
                    </div>
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.b3hub"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-foreground text-background hover:bg-foreground/90 transition-colors px-5 py-3.5"
                    aria-label="Lejupielādēt Google Play"
                  >
                    <AppIcon ios={false} />
                    <div className="flex flex-col leading-tight">
                      <span className="text-background/50 text-xs">Lejupielādēt</span>
                      <span className="text-sm font-medium">Google Play</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── 5. FINAL CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-none">
              Gatavs sākt
              <br />
              strādāt gudrāk?
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`${APP_URL}/register`} variant="inverted" size="lg">
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
