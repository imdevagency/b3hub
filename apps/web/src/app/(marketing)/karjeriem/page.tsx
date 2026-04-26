import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { ArrowRight, CheckCircle, Bell, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { FAQAccordion } from '@/components/marketing/ui/faq-accordion';

const journey = [
  {
    step: '01',
    title: 'Reģistrē un publicē',
    body: 'Pievienojiet karjera profilu ar materiāliem, frakcijām un cenām. Verificācija 48h laikā — pēc tam esat katalogā.',
    features: [
      'Bezmaksas sarakste ar pircēju jau pirms apstiprināšanas',
      'Profils redzams 240+ pircēju katalogā',
    ],
  },
  {
    step: '02',
    title: 'Saņem pasūtījumu',
    body: 'Klients atrod jūs katalogā un pasūta tiešsaistē. Nav zvanu, nav cenu jautājumu — ierodas gatavs pasūtījums.',
    features: ['Push paziņojums ar detaļām uzreiz', 'Pircēja dati un piegādes adrese iekļauta'],
  },
  {
    step: '03',
    title: 'Apstiprina & iekrauj',
    body: 'Apstiprini iekraušanas laiku. B3Hub piešķir šoferi automātiski — nav jāmeklē transports.',
    features: ['Transports organizēts platformas pusē', 'SMS un app paziņojums šoferim'],
  },
  {
    step: '04',
    title: 'Saņem samaksu',
    body: 'Pēc piegādes platforma ģenerē rēķinu un svara zīmi. Samaksa no pircēja — automātiski, bez atgādinājumiem.',
    features: ['Svara zīme un CMR automātiski', 'Visi dokumenti arhīvā mākonī 5 gadus'],
  },
];

const materials = [
  'Šķembas & grants',
  'Smilts',
  'Dolomīts',
  'Augsne & kūdra',
  'Betons & reciklāts',
  'Asfalts',
  'Mālsmilts & māls',
  'Laukakmeņi',
];

export default function KarjeriemPage() {
  return (
    <>
      <main className="bg-background text-foreground w-full overflow-clip">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Karjeriem & Piegādātājiem"
          title={
            <>
              Pasūtījums
              <br />
              ierodas pats.
              <br />
              Tu iekrauj.
            </>
          }
          subtitle="Publicē savus materiālus katalogā — B3Hub parāda tos visiem Latvijas pasūtītājiem. Transports, dokumenti un samaksa — automātiski."
          actions={
            <>
              <CTAButton href={`/register?role=seller`} variant="primary" size="lg">
                Pievienot karjeru
              </CTAButton>
              <CTAButton href="/contact" variant="outline" size="lg">
                Runāt ar pārdošanu
              </CTAButton>
            </>
          }
          pricingNote="Bezmaksas reģistrācija. 6% komisija tikai no veiksmīgiem pasūtījumiem."
        >
          {/* Right: mock incoming order card */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-mono text-xs text-muted-foreground tracking-widest">
                  Jauns pasūtījums
                </span>
              </div>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                Gaida apstiprinājumu
              </span>
            </div>

            <div className="flex flex-col gap-6 p-8">
              {/* Order details */}
              <div>
                <p className="text-2xl font-bold tracking-tight leading-none mb-2">
                  Granīta šķembas 20–40
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  18 tonnas · Piegāde: šodien 14:00
                </p>
              </div>

              {/* Buyer + route */}
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
                <div className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Pircējs</p>
                  <p className="font-medium">SIA "BūvPro"</p>
                  <p className="text-xs text-muted-foreground">Rīga, Ziepniekkalns</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Ieņēmumi
                  </p>
                  <p className="text-2xl font-bold tracking-tight">€156</p>
                  <p className="text-xs text-muted-foreground">kopā no pasūtījuma</p>
                </div>
              </div>

              {/* Auto dispatch note */}
              <div className="flex items-start gap-3 text-xs text-muted-foreground border border-border p-4">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>
                  Šoferis tiks piešķirts automātiski pēc iekraušanas apstiprināšanas. Nav
                  nepieciešams organizēt transportu.
                </span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border py-3 text-center text-sm font-medium text-muted-foreground">
                  Noraidīt
                </div>
                <div className="bg-foreground text-background py-3 text-center text-sm font-medium">
                  Apstiprināt iekraušanu
                </div>
              </div>
            </div>
          </div>
        </Hero>

        {/* ── BEFORE → AFTER ── */}
        <section className="w-full bg-neutral-50">
          <Container className="py-32">
            <div className="flex flex-col md:flex-row gap-16 items-start">
              <div className="md:w-2/5 flex flex-col gap-4">
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                  Problēma
                </p>
                <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight">
                  Karjeri tērē laiku tālrunim, nevis pārdošanai.
                </h2>
              </div>
              <div className="md:w-3/5 flex flex-col divide-y divide-border border-t border-b border-border w-full">
                {(
                  [
                    { before: 'Zvani ar cenu jautājumiem', after: 'Klients redz cenu katalogā' },
                    {
                      before: 'Manuāla iekraušanas koordinācija',
                      after: 'Pasūtījums ierodas gatavs',
                    },
                    { before: 'Papīra svara zīmes', after: 'Automātiska digitāla svara zīme' },
                    { before: 'Kavēti rēķini', after: 'Samaksa automātiski pēc piegādes' },
                  ] as { before: string; after: string }[]
                ).map(({ before, after }) => (
                  <div key={before} className="py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-muted-foreground font-light line-through decoration-1 text-lg">
                      {before}
                    </p>
                    <p className="text-foreground font-medium text-lg flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      {after}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* ── BENTO FEATURES ── */}
        <section className="w-full bg-background">
          <Container className="py-24">
            <div className="flex flex-col gap-16">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mb-4">
                  Mazāk tālruņa.
                  <br />
                  Vairāk pasūtījumu.
                </h2>
                <p className="text-xl text-muted-foreground font-light">
                  B3Hub nodrošina visu no pasūtījuma saņemšanas līdz samaksai — bez manuālas
                  koordinācijas.
                </p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[280px]">
                {/* Feature 1: Large Wide */}
                <div className="md:col-span-2 bg-muted/30 border border-border p-8 flex flex-col justify-between group overflow-hidden relative">
                  <div className="z-10 max-w-sm">
                    <h3 className="text-2xl font-bold tracking-tight mb-2">
                      Pasūtījums — gatavs uzreiz
                    </h3>
                    <p className="text-muted-foreground font-light text-lg">
                      Klients pasūta katalogā ar norādītu daudzumu, piegādes adresi un laiku. Jūs
                      tikai apstipriniet iekraušanu.
                    </p>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-80 h-64 bg-background border border-border rounded-2xl shadow-2xl skew-x-[-4deg] rotate-[4deg] transition-transform group-hover:rotate-0 group-hover:skew-x-0 duration-500 ease-out hidden md:flex flex-col justify-between p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                        <span className="text-xs font-mono tracking-widest text-muted-foreground">
                          Jauns pasūtījums
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight">Granīta šķembas 20–40</p>
                      <p className="text-sm text-muted-foreground">18 t · Rīga · šodien 14:00</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 border border-border py-2 text-center text-xs text-muted-foreground">
                        Noraidīt
                      </div>
                      <div className="flex-1 bg-foreground text-background py-2 text-center text-xs font-medium">
                        Apstiprināt
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  <h3 className="text-6xl font-black tracking-tighter mb-2 z-10 mt-auto">6%</h3>
                  <p className="text-muted-foreground font-light z-10">
                    Komisija tikai no veiksmīgiem pasūtījumiem. Nav abonēšanas.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-muted/30 border border-border p-8 flex flex-col justify-between text-center">
                  <h3 className="text-6xl font-black tracking-tighter mb-2 mt-auto">Auto</h3>
                  <p className="text-muted-foreground font-light">
                    Šoferis piešķirts automātiski. Nav jāmeklē transports.
                  </p>
                </div>

                {/* Feature 4: Dark Wide */}
                <div className="md:col-span-2 bg-foreground text-background p-8 flex flex-col justify-between overflow-hidden relative">
                  <div className="z-10 max-w-sm">
                    <h3 className="text-2xl font-bold tracking-tight mb-2">
                      Visi dokumenti automātiski
                    </h3>
                    <p className="text-background/70 font-light text-lg">
                      Svara zīme, CMR un rēķins tiek ģenerēti uzreiz pēc piegādes. Arhīvs mākonī 5
                      gadus — jebkad pieejams.
                    </p>
                  </div>
                  <div className="absolute right-0 bottom-0 top-0 w-1/2 bg-linear-to-l from-background/20 to-transparent items-center justify-end pr-8 hidden md:flex">
                    <div className="w-48 h-32 bg-background/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-xl font-bold text-white tracking-widest uppercase">
                        E-ARHĪVS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── STICKY JOURNEY ── */}
        <section className="w-full bg-neutral-50">
          <Container className="py-24">
            <div className="flex flex-col md:flex-row gap-16 relative pb-32">
              {/* Left: Scrollable Text Steps */}
              <div className="md:w-1/2 flex flex-col gap-32 py-24">
                {journey.map((item) => (
                  <div key={item.step} className="flex flex-col gap-5 pr-8">
                    <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground border-b border-border pb-4 w-12">
                      {item.step}
                    </span>
                    <h3 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight mt-2">
                      {item.title}
                    </h3>
                    <p className="text-xl text-muted-foreground font-light leading-relaxed">
                      {item.body}
                    </p>
                    <ul className="flex flex-col gap-3 mt-4 border-t border-border pt-6">
                      {item.features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-sm font-light">
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Right: Sticky Phone Mockup */}
              <div className="md:w-1/2 relative hidden md:block">
                <div className="sticky top-32 w-full max-w-md mx-auto aspect-9/18 bg-muted/20 border border-border rounded-[3rem] p-4 flex flex-col gap-2 shadow-2xl">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-border rounded-b-2xl z-20" />

                  {/* App header */}
                  <div className="w-full h-14 mt-4 flex gap-3 items-center px-4">
                    <div className="w-8 h-8 rounded-full bg-foreground" />
                    <div className="h-3 w-28 bg-foreground/90 rounded-full" />
                  </div>

                  {/* Order card */}
                  <div className="flex-1 flex flex-col gap-3 py-4 px-2 overflow-hidden relative">
                    {/* Incoming order */}
                    <div className="w-full bg-background border border-border shadow-sm rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                          <span className="text-xs font-mono tracking-widest text-muted-foreground">
                            Jauns pasūtījums
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-base">Granīta šķembas 20–40</p>
                        <p className="text-xs text-muted-foreground">18 t · SIA "BūvPro" · Rīga</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Ieņēmumi</p>
                          <p className="text-xl font-black tracking-tight">€156</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Piegāde</p>
                          <p className="text-sm font-medium">šodien 14:00</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border border-border py-2 text-center text-xs font-medium text-muted-foreground rounded">
                          Noraidīt
                        </div>
                        <div className="bg-foreground text-background py-2 text-center text-xs font-medium rounded">
                          Apstiprināt
                        </div>
                      </div>
                    </div>
                    {/* Older orders faded */}
                    <div className="w-full h-16 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4 opacity-40">
                      <div className="w-10 h-8 bg-muted rounded-lg" />
                      <div className="flex-1 flex flex-col gap-1.5 justify-center">
                        <div className="w-2/3 h-2 bg-muted-foreground rounded-full" />
                        <div className="w-1/3 h-2 bg-muted rounded-full" />
                      </div>
                      <p className="text-sm font-bold self-center">€98</p>
                    </div>
                    <div className="w-full h-16 bg-background border border-border shadow-sm rounded-2xl p-4 flex gap-4 opacity-20">
                      <div className="w-10 h-8 bg-muted rounded-lg" />
                      <div className="flex-1 flex flex-col gap-1.5 justify-center">
                        <div className="w-1/2 h-2 bg-muted-foreground rounded-full" />
                        <div className="w-1/4 h-2 bg-muted rounded-full" />
                      </div>
                      <p className="text-sm font-bold self-center">€204</p>
                    </div>
                    {/* Gradient fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-muted/20 to-transparent" />
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── MATERIALS + PRICING + STATS ── */}
        <section className="w-full bg-background">
          <Container className="py-32">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {/* Materials */}
              <div className="bg-background p-10 flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                    Ko var pārdot?
                  </p>
                  <h2 className="text-4xl font-medium tracking-tighter leading-tight">
                    Ja tev ir materiāls, mums ir pircējs.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {materials.map((m) => (
                    <span
                      key={m}
                      className="border border-border px-4 py-2 text-sm font-light text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-light">
                  Nav sava materiāla sarakstā?{' '}
                  <Link
                    href="/contact"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Sazinieties ar mums
                  </Link>
                </p>
              </div>

              {/* Pricing + Stats stacked */}
              <div className="flex flex-col">
                <div className="bg-foreground text-background p-10 flex flex-col gap-4 flex-1">
                  <p className="text-sm font-bold tracking-widest uppercase text-background/50">
                    Cena
                  </p>
                  <p className="text-7xl font-bold tracking-tighter leading-none">6%</p>
                  <p className="text-background/60 font-light">
                    komisija no veiksmīgiem pasūtījumiem. Reģistrācija bezmaksas.
                  </p>
                  <CTAButton
                    href={`/register?role=seller`}
                    variant="inverted"
                    className="mt-4 w-fit"
                  >
                    Sākt izmēģināt
                  </CTAButton>
                </div>
                <div className="bg-background border-t border-border p-10 grid grid-cols-3 gap-6">
                  {[
                    { value: '18', label: 'Piegādātāji' },
                    { value: '240+', label: 'Pārvadātāji' },
                    { value: '1.5M+', label: 'Tonnas' },
                  ].map(({ value, label }) => (
                    <div key={label}>
                      <p className="text-3xl md:text-4xl font-bold tracking-tighter leading-none">
                        {value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 font-light">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── FAQ ── */}
        <FAQAccordion
          className="bg-neutral-50"
          items={[
            {
              q: 'Cik maksā reģistrēties kā piegādātājam?',
              a: 'Bezmaksas. Reģistrācija un materiālu publicēšana ir bez maksas. Jūs maksājat 6% komisiju tikai no veiksmīgi noslēgtiem pasūtījumiem. Nav abonēšanas. Nav slēpto maksājumu.',
            },
            {
              q: 'Cik ātri varu sākt saņemt pasūtījumus?',
              a: 'Pēc profila apstiprināšanas (parasti 1–2 darba dienas) jūsu materiāli ir redzami katalogā.',
            },
            {
              q: 'Vai platforma koordinē transportu manā vietā?',
              a: 'Jā. Jums nav jāmeklē šoferi — B3Hub savieno jūs ar apstiprinātu pārvadātāju tīklu.',
            },
            {
              q: 'Kas notiek, ja pircējs atceļ pasūtījumu?',
              a: 'Atcelšanas politika ir skaidra platformā. Ja materiāls jau ir iekrauts, atlīdzina transporta izmaksas.',
            },
          ]}
        />

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-background leading-none">
              Pievienojies
              <br />
              tīklam šodien.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register?role=seller`} variant="inverted" size="lg">
                Reģistrēt karjeru
              </CTAButton>
              <Link
                href="/contact"
                className="text-center text-background/40 text-sm hover:text-background/70 transition-colors"
              >
                Vai sazinieties ar mums →
              </Link>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
