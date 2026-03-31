import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
import { CTAButton } from '@/components/ui/cta-button';

export const metadata: Metadata = {
  title: 'Cenas',
  description:
    'Pārredzamas B3Hub cenas pircējiem, piegādātājiem un pārvadātājiem. Bez slēptajām maksām.',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const plans = [
  {
    name: 'Pircējs',
    price: 'Bezmaksas',
    description: 'Pasūtiet materiālus un izsekojiet piegādēm bez abonēšanas maksas.',
    href: `${APP_URL}/register`,
    cta: 'Sākt bez maksas',
    featured: false,
    features: [
      'Neierobežoti pasūtījumi',
      'Reāllaika piegāžu izsekošana',
      'Digitālie piegādes dokumenti',
      'Vēsture un rēķini',
      'Mobilā lietotne (iOS & Android)',
    ],
  },
  {
    name: 'Piegādātājs',
    price: '€49',
    period: '/mēnesī',
    description: 'Publicējiet materiālus, saņemiet pasūtījumus un pārvaldiet savu biznesu.',
    href: `${APP_URL}/apply`,
    cta: 'Pieteikties',
    featured: true,
    features: [
      'Neierobežoti materiālu ieraksti',
      'Pasūtījumu pārvaldība',
      'Automātiskie rēķini',
      'Piegādes koordinācija',
      'Analītika un pārskati',
      'Prioritārs atbalsts',
    ],
  },
  {
    name: 'Pārvadātājs',
    price: '8%',
    period: ' komisija',
    description: 'Mēs iekasējam 8% komisiju no katras sekmīgas piegādes. Bez ikmēneša maksas.',
    href: `${APP_URL}/apply`,
    cta: 'Pieteikties',
    featured: false,
    features: [
      'Piekļuve visiem transporta darbiem',
      'Darbu izvēle brīvi',
      'Izmaksa nākamajā darba dienā',
      'Digitālie pavadraksti',
      'Maršrutu plānošana lietotnē',
    ],
  },
];

const faq = [
  {
    q: 'Vai ir kādi papildu maksājumi?',
    a: 'Nē. Pircējiem nav nekādu maksu. Piegādātājiem ir fiksēta €49/mēn abonēšana — bez komisijas. Pārvadātājiem 8% komisija no katras piegādes un nekas vairāk.',
  },
  {
    q: 'Kā notiek maksājumi pārvadātājiem?',
    a: 'Izmaksa tiek veikta nākamajā darba dienā pēc piegādes apstiprināšanas. Minimālā izmaksa €10.',
  },
  {
    q: 'Vai var atcelt piegādātāja abonementu?',
    a: 'Jā, jelkad. Nav iesaistīšanās perioda un nav soda naudas. Pārtrauc no nākamā rēķina perioda.',
  },
  {
    q: 'Kas ir iekļauts €49 plānā?',
    a: 'Visi uzskaitītie rīki: katalogu saraksti, automātiskie dokumenti, analītika un prioritārs atbalsts. Nav neviena "premium" papildinājuma.',
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Cenas"
          title={
            <>
              Vienkāršas,
              <br />
              pārredzamas.
            </>
          }
          subtitle="Nav slēpto maksu. Nav pārsteigumu. Katrai lomai savs modelis."
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
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tighter leading-none">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className={`text-base ${plan.featured ? 'text-background/60' : 'text-muted-foreground'}`}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm font-light leading-relaxed ${plan.featured ? 'text-background/60' : 'text-muted-foreground'}`}
                  >
                    {plan.description}
                  </p>
                </div>

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
      <Footer />
    </>
  );
}
