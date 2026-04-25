import type { Metadata } from 'next';
import { Check, ArrowRight } from 'lucide-react';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';

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
        <Container as="section" className="pb-32 border-t border-border pt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col p-10 gap-8 relative ${
                  plan.featured ? 'bg-foreground text-background' : 'bg-background text-foreground'
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
                    className={`rounded-xl p-4 text-sm ${plan.featured ? 'bg-background/10' : 'bg-muted/50'}`}
                  >
                    <p
                      className={`font-semibold mb-1 ${plan.featured ? 'text-background/70' : 'text-muted-foreground'}`}
                    >
                      Piemērs
                    </p>
                    <div
                      className={`flex items-center justify-between ${plan.featured ? 'text-background/80' : 'text-foreground'}`}
                    >
                      <span>Pasūtījums €{plan.example.order}</span>
                      <ArrowRight className="h-3.5 w-3.5 mx-2 shrink-0 opacity-40" />
                      <span className="font-bold">
                        Komisija €{(plan.example.order * plan.example.rate).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Features */}
                <ul className="flex flex-col gap-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check
                        className={`h-4 w-4 shrink-0 mt-0.5 ${plan.featured ? 'text-background/50' : 'text-foreground'}`}
                        strokeWidth={2.5}
                      />
                      <span
                        className={`text-sm font-light ${plan.featured ? 'text-background/80' : 'text-muted-foreground'}`}
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

        {/* ── HOW IT WORKS ── */}
        <Container as="section" className="pb-32 border-t border-border pt-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Kā darbojas komisija
          </h2>
          <p className="text-muted-foreground text-lg font-light mb-16 max-w-xl">
            Visi darījumi iet caur platformu. Komisija tiek ieturēta automātiski — neviens rēķins,
            nekāda uzskaite.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {[
              {
                step: '01',
                title: 'Pircējs veic pasūtījumu',
                body: 'Pircējs samaksā pasūtījuma summu. Nauda tiek turēta platformas escrow.',
              },
              {
                step: '02',
                title: 'Piegāde tiek izpildīta',
                body: 'Piegādātājs un pārvadātājs izpilda pasūtījumu. Sistēma reģistrē pabeigšanu.',
              },
              {
                step: '03',
                title: 'Komisija tiek ieturēta automātiski',
                body: 'No maksājuma automātiski tiek ieturēta piegādātāja (6%) un pārvadātāja (8%) komisija. Atlikums izmaksāts nākamajā darba dienā.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="bg-background p-10 flex flex-col gap-4">
                <span className="text-sm font-bold tracking-widest text-muted-foreground">
                  {step}
                </span>
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── FAQ ── */}
        <Container as="section" className="pb-32 border-t border-border pt-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-16 md:mb-24">
            Biežāk uzdotie jautājumi
          </h2>
          <div className="flex flex-col">
            {faq.map(({ q, a }) => (
              <div
                key={q}
                className="flex flex-col md:flex-row gap-4 md:gap-12 py-10 border-t border-border"
              >
                <div className="md:w-1/2">
                  <h3 className="text-2xl font-medium tracking-tight">{q}</h3>
                </div>
                <div className="md:w-1/2">
                  <p className="text-muted-foreground font-light text-lg md:text-xl leading-relaxed">
                    {a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </main>
    </>
  );
}
