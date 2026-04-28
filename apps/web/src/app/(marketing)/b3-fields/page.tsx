import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { ArrowRight, Package, Recycle, Truck, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { FAQAccordion } from '@/components/marketing/ui/faq-accordion';

export const metadata: Metadata = {
  // NOTE: metadata export is kept so the page config is preserved for future use
  title: 'B3 Fields — Fiziskie loģistikas punkti Latvijā | B3Hub',
  description:
    'Paņem celtniecības materiālus, nodod atkritumus ar juridiski derīgu sertifikātu un īrē piekabes 6 punktos visā Latvijā. Viss caur B3Hub platformu.',
  openGraph: {
    title: 'B3 Fields — Fiziskie loģistikas punkti Latvijā',
    description:
      'Materiālu paņemšana, atkritumu nodošana un piekabju noma. 6 punkti. Dokumenti automātiski.',
    url: 'https://b3hub.lv/b3-fields',
    siteName: 'B3Hub',
    locale: 'lv_LV',
    type: 'website',
  },
};

type B3FieldService = 'MATERIAL_PICKUP' | 'WASTE_DISPOSAL' | 'TRAILER_RENTAL';

const SERVICE_LABELS: Record<B3FieldService, string> = {
  MATERIAL_PICKUP: 'Paņemšana',
  WASTE_DISPOSAL: 'Atkritumi',
  TRAILER_RENTAL: 'Piekabe',
};

interface ApiFieldItem {
  id: string;
  name: string;
  city: string;
  address: string;
  services: B3FieldService[];
  active: boolean;
}

async function fetchFields(): Promise<ApiFieldItem[]> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
    const res = await fetch(`${base}/b3-fields`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return (await res.json()) as ApiFieldItem[];
  } catch {
    return [];
  }
}

const services = [
  {
    icon: Package,
    title: 'Materiālu paņemšana',
    body: 'Nopērciet materiālu platformā un paņemiet to ar savu auto. Ideāli māju saimniekiem — bez piegādes izmaksām.',
    badge: 'Pieejams visās 6 vietās',
    features: ['Digitāls čeks uzreiz', 'Nav minimālā pasūtijuma'],
  },
  {
    icon: Recycle,
    title: 'Atkritumu nodošana',
    body: 'Celtniecības atkritumu izvešana bez reģistrācijas var izmaksāt līdz €5 000 naudas soda. B3 Field ģenerē juridiski derīgu sertifikātu automātiski — uz vietas.',
    badge: 'ES Direktīva 2008/98/EK',
    features: ['Sertifikāts < 30 sekundēs', 'Arhīvs platformā 5 gadus'],
  },
  {
    icon: Truck,
    title: 'Piekabe īrei',
    body: 'Maziem pasūtījumiem, kad liels kravas auto nav vajadzīgs. Iznomājiet uz vietas, atgrieziet jebkurā B3 Field punktā Latvijā.',
    badge: 'No €25 / dienā',
    features: ['Atgriešana jebkurā punktā', 'Piesaistīts pasūtijumam automātiski'],
  },
];

export default async function B3FieldsPage() {
  const apiFields = await fetchFields();

  // Use API data when available; fall back to static placeholders only when the
  // API returns nothing (e.g. during build / preview without a running backend).
  const locations =
    apiFields.length > 0
      ? apiFields
          .filter((f) => f.active)
          .map((f) => ({
            city: f.city,
            address: f.address,
            services: f.services.map((s) => SERVICE_LABELS[s] ?? s),
          }))
      : [
          {
            city: 'Rīga',
            address: 'Maskavas iela 300',
            services: ['Paņemšana', 'Atkritumi', 'Piekabe'],
          },
          { city: 'Jelgava', address: 'Rūpniecības iela 45', services: ['Paņemšana', 'Atkritumi'] },
          { city: 'Liepāja', address: 'Klaipēdas šoseja 12', services: ['Paņemšana', 'Piekabe'] },
          {
            city: 'Valmiera',
            address: 'Rīgas iela 78',
            services: ['Paņemšana', 'Atkritumi', 'Piekabe'],
          },
          { city: 'Jēkabpils', address: 'Brīvības iela 34', services: ['Paņemšana'] },
          { city: 'Daugavpils', address: 'Varoņu iela 9', services: ['Paņemšana', 'Atkritumi'] },
          { city: 'Gulbene', address: 'Noliktavas iela 2', services: ['Paņemšana', 'Atkritumi'] },
        ];
  return (
    <>
      <main className="bg-background text-foreground w-full overflow-hidden">
        {/* ── HERO ── */}
        <Hero
          eyebrow="B3 Fields"
          title={
            <>
              Fiziski punkti.
              <br />
              Digitāli
              <br />
              darījumi.
            </>
          }
          subtitle="Paņem materiālus vai nodod atkritumus ar juridiski derīgu sertifikātu. Viss vienā lietotnē."
          actions={
            <>
              <CTAButton href="#locations" variant="primary" size="lg">
                Apskatīt lokācijas
              </CTAButton>
              <CTAButton href={`/register`} variant="outline" size="lg">
                Reģistrēties
              </CTAButton>
            </>
          }
        ></Hero>

        {/* ── LOCATIONS ── */}
        <section className="w-full bg-neutral-50">
          <Container id="locations" className="py-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
              <div className="flex flex-col gap-4">
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                  B3 Tīkls
                </p>
                <h2 className="text-5xl md:text-6xl font-bold tracking-tighter leading-none">
                  6 punkti.
                  <br />
                  Visā Latvijā.
                </h2>
              </div>
              <div className="flex flex-col gap-2 md:text-right">
                <p className="text-muted-foreground font-light text-sm">
                  Jaunas vietas gaidāmas 2026. gadā.
                </p>
                <p className="text-muted-foreground font-light text-sm">
                  P–Pk 07:00–19:00 · Sest 08:00–16:00
                </p>
              </div>
            </div>
            <div className="flex flex-col border-t border-border">
              {locations.map(({ city, address, services: svc }) => (
                <div
                  key={city}
                  className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4 border-b border-border"
                >
                  <div className="flex items-baseline gap-8 min-w-0">
                    <h3 className="text-3xl font-medium tracking-tight shrink-0">{city}</h3>
                    <p className="text-muted-foreground font-light text-lg truncate">{address}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap md:justify-end shrink-0">
                    {svc.map((s) => (
                      <span
                        key={s}
                        className="text-xs font-bold tracking-widest uppercase bg-muted text-foreground px-3 py-1.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── FAQ ── */}
        <FAQAccordion
          items={[
            {
              q: 'Vai jāreģistrējas, lai izmantotu B3 Field?',
              a: 'Jā — reģistrācija ir bezmaksas un aizņem < 2 minūtes. Nepieciešama rezervācijai un dokumentu saņemšanai.',
            },
            {
              q: 'Kādus maksājumus pieņemat?',
              a: 'Maksājums notiek caur platformu pirms ierašanās — ar bankas karti vai pārskaitījumu. Skaidra nauda nav pieņemta.',
            },
            {
              q: 'Vai atkritumu sertifikāts ir juridiski derīgs?',
              a: 'Jā. Sertifikāts atbilst ES Direktīvai 2008/98/EK un Latvijas normatīvajiem aktiem. Pieejams platformā bez termiņa.',
            },
            {
              q: 'Vai piekabe jāatgriež tajā pašā vietā?',
              a: 'Atgriešanas nosacījumi tiek apstiprināti rezervācijas brīdī. Sazinieties ar mums, lai noskaidrotu atgriešanas opcijas savai konkrētajai rezervācijai.',
            },
          ]}
        />

        {/* ── CTA ── */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col items-center justify-center text-center gap-8">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-background leading-none">
              Sāc jau šodien.
            </h2>
            <p className="text-xl text-background/50 font-light max-w-md">
              Reģistrācija bezmaksas. Pirmā vizīte bez gaidīšanas.
            </p>
            <div className="flex flex-col items-center gap-4 mt-4">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Izveidot bezmaksas kontu
              </CTAButton>
              <Link
                href="/contact"
                className="text-background/40 text-sm hover:text-background/70 transition-colors"
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
