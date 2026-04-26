import type { Metadata } from 'next';
import { Check, ArrowRight } from 'lucide-react';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { FAQAccordion } from '@/components/marketing/ui/faq-accordion';

export const metadata: Metadata = {
  title: 'Cenas',
  description:
    'B3Hub komisijas modelis: maksājiet tikai tad, kad nopelnāt. Bez abonēšanas maksas, bez slēptajām maksām.',
};

const plans = [
  {
    name: 'Pircējs',
    price: '0%',
    label: 'Pilnīgi bez maksas',
    description:
      'Pasūtiet materiālus, izsekojiet piegādēm, pārvaldiet projektu izmaksas — bez jebkādas maksas.',
    href: `/register`,
    cta: 'Sākt bez maksas',
    featured: false,
    features: [
      'Neierobežoti pasūtījumi',
      'Reāllaika piegāžu izsekošana',
      'Digitālie piegādes dokumenti',
      'Projektu izmaksu pārskati',
      'Mobilā lietotne (iOS & Android)',
      'Komandas pārvaldība (B2B)',
    ],
  },
  {
    name: 'Piegādātājs',
    price: '6%',
    label: 'no katras pasūtījuma vērtības',
    description: 'Publicējiet materiālus bez maksas. Maksājiet tikai tad, kad saņemat pasūtījumu.',
    href: `/apply`,
    cta: 'Pieteikties',
    featured: true,
    features: [
      'Neierobežoti materiālu ieraksti',
      'Pasūtījumu pārvaldība',
      'Automātiskie rēķini un dokumenti',
      'Piegādes koordinācija',
      'Analītika un pārdošanas pārskati',
      'Prioritārs atbalsts',
    ],
    example: { order: 500, rate: 0.06 },
  },
  {
    name: 'Pārvadātājs',
    price: '8%',
    label: 'no katras piegādes vērtības',
    description: 'Izvēlieties darbus brīvi. Mēs iekasējam komisiju tikai no sekmīgām piegādēm.',
    href: `/apply`,
    cta: 'Pieteikties',
    featured: false,
    features: [
      'Piekļuve visiem transporta darbiem',
      'Darbu izvēle bez saistībām',
      'Izmaksa nākamajā darba dienā',
      'Digitālie pavadraksti',
      'Maršrutu plānošana lietotnē',
    ],
    example: { order: 300, rate: 0.08 },
  },
];

const faq = [
  {
    q: 'Vai piegādātājiem ir ikmēneša maksa?',
    a: 'Nē. Nav abonēšanas, nav reģistrācijas maksas, nav maksa par ierakstiem. Jūs maksājat tikai 6% komisiju no katras pasūtījuma vērtības, kas veiksmīgi noslēgusies platformā.',
  },
  {
    q: 'Kā tiek aprēķināta komisija?',
    a: 'Komisija tiek aprēķināta no kopējās pasūtījuma summas bez PVN. Piemēram, €500 pasūtījumam piegādātājs maksā €30 (6%), pārvadātājs par €300 piegādi maksā €24 (8%).',
  },
  {
    q: 'Kad notiek komisijas ieturēšana?',
    a: 'Komisija tiek ieturēta automātiski pēc pasūtījuma apstiprināšanas un piegādes pabeigšanas. Pircēja maksājums tiek noturēts escrow līdz piegāde ir apstiprināta.',
  },
  {
    q: 'Kā notiek izmaksa pārvadātājiem?',
    a: 'Izmaksa tiek veikta nākamajā darba dienā pēc piegādes apstiprināšanas. Minimālā izmaksa €10. Atbalstām Latvijas bankas pārskaitījumus.',
  },
  {
    q: 'Vai var strādāt gan kā piegādātājs, gan pārvadātājs?',
    a: 'Jā. Uzņēmums ar "HYBRID" tipu var vienlaikus pārdot materiālus un piedāvāt transportu. Katrai darbībai komisija tiek aprēķināta atsevišķi.',
  },
];

export default function PricingPage() {
  return (
    <>
      <main className="bg-background text-foreground">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Cenas"
          title={
            <>
              Maksājiet tikai tad,
              <br />
              kad nopelnāt.
            </>
          }
          subtitle="Nav abonēšanas. Nav reģistrācijas maksas. Komisija tikai no sekmīgiem darījumiem."
          align="center"
        />

        {/* ── PLANS ── */}
        <section className="w-full bg-neutral-50">
          <Container className="pb-32 pt-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col p-10 md:p-12 gap-8 relative rounded-[2rem] shadow-xl ${
                    plan.featured
                      ? 'bg-foreground text-background scale-100 md:scale-105 z-10'
                      : 'bg-background text-foreground'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute top-6 right-6 text-xs font-bold tracking-widest uppercase text-background/50">
                      Populārākais
                    </span>
                  )}

                  {/* Name + price */}
                  <div className="flex flex-col gap-3">
                    <p
                      className={`text-sm font-bold tracking-widest uppercase ${plan.featured ? 'text-background/50' : 'text-muted-foreground'}`}
                    >
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold tracking-tighter leading-none">
                        {plan.price}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-semibold ${plan.featured ? 'text-background/70' : 'text-muted-foreground'}`}
                    >
                      {plan.label}
                    </p>
                    <p
                      className={`text-sm font-light leading-relaxed ${plan.featured ? 'text-background/60' : 'text-muted-foreground'}`}
                    >
                      {plan.description}
                    </p>
                  </div>

                  {/* Example calculation */}
                  {'example' in plan && plan.example && (
                    <div
                      className={`rounded-2xl p-5 text-sm ${plan.featured ? 'bg-background/10' : 'bg-neutral-100'}`}
                    >
                      <p
                        className={`font-semibold mb-2 tracking-widest uppercase text-xs ${plan.featured ? 'text-background/70' : 'text-muted-foreground'}`}
                      >
                        Piemērs
                      </p>
                      <div
                        className={`flex items-center justify-between font-medium ${plan.featured ? 'text-background/90' : 'text-foreground'}`}
                      >
                        <span>Pasūtījums €{plan.example.order}</span>
                        <ArrowRight className="h-4 w-4 mx-2 shrink-0 opacity-40" />
                        <span className="font-bold text-base">
                          Komisija €{(plan.example.order * plan.example.rate).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  <ul className="flex flex-col gap-4 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 p-1 rounded-full ${plan.featured ? 'bg-background/10 text-background/80' : 'bg-neutral-100 text-foreground'}`}
                        >
                          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                        </div>
                        <span
                          className={`text-base font-light leading-snug ${plan.featured ? 'text-background/80' : 'text-muted-foreground'}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <CTAButton
                    href={plan.href}
                    variant={plan.featured ? 'inverted' : 'primary'}
                    className="w-full justify-center"
                  >
                    {plan.cta}
                  </CTAButton>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="w-full bg-background">
          <Container className="pb-32 pt-16">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 relative z-10">
              Kā darbojas komisija
            </h2>
            <p className="text-muted-foreground text-xl font-light mb-12 max-w-2xl relative z-10 leading-relaxed">
              Visi darījumi iet caur platformu. Komisija tiek ieturēta automātiski — neviens rēķins,
              nekāda uzskaite.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  title: 'Pircējs veic pasūtījumu',
                  body: 'Pircējs samaksā pasūtījuma summu. Nauda tiek turēta platformas escrow norēķinu kontā drošībā.',
                },
                {
                  step: '02',
                  title: 'Piegāde tiek izpildīta',
                  body: 'Piegādātājs un pārvadātājs izpilda pasūtījumu. Sistēma reģistrē pabeigšanu izkraušanas punktā.',
                },
                {
                  step: '03',
                  title: 'Komisija ieturēta automātiski',
                  body: 'No gala maksājuma automātiski atskaita piegādātāja (6%) un pārvadātāja (8%) daļu. Atlikums nākamajā dienā jūsu kontā.',
                },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="bg-neutral-50 rounded-[2rem] p-10 md:p-12 flex flex-col gap-5 shadow-sm"
                >
                  <span className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
                    {step} solis
                  </span>
                  <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground text-lg font-light leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── FAQ ── */}
        <FAQAccordion items={faq} className="bg-neutral-50" />

        {/* ── ENTERPRISE / VOLUME ── */}
        <section className="w-full bg-background pb-32">
          <Container>
            <div className="flex flex-col md:flex-row md:items-center bg-neutral-50 rounded-[4rem] p-12 md:p-20 justify-between gap-12 shadow-sm border border-border/50">
              <div className="max-w-2xl flex flex-col gap-6">
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                  Liels apjoms?
                </p>
                <h2 className="text-5xl md:text-7xl font-bold tracking-tighter leading-none">
                  Individuāli
                  <br /> noteikumi.
                </h2>
                <p className="text-muted-foreground text-xl font-light leading-relaxed">
                  Uzņēmumiem ar augstu darījumu apjomu — piegādātājiem, pārvadātājiem un būvniecības
                  kompānijām ar vairākiem aktīviem projektiem — piedāvājam individuālu komisijas
                  struktūru un integrāciju esošajās sitēmās.
                </p>
              </div>
              <div className="shrink-0 flex items-center justify-center">
                <CTAButton href="/contact" variant="primary" size="lg">
                  Sazināties ar komandu
                </CTAButton>
              </div>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
