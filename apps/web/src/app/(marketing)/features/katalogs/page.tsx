import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { Check, ArrowLeft, Package, DollarSign, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: DollarSign,
    title: 'Reālās cenas — nekādu "piezvani noskaidrot"',
    body: 'Visi piegādātāji publicē aktuālās cenas, pieejamību un minimālos pasūtījumu apjomus. Tu redzi cenu pirms pasūtīšanas, nevis pēc.',
  },
  {
    icon: MapPin,
    title: 'Tuvākie piegādātāji automātiski augšā',
    body: 'Katalogs pēc noklusēšanas kārto piegādātājus pēc attāluma no tava objekta, lai redzētu ekonomiski izdevīgākās opcijas.',
  },
  {
    icon: Package,
    title: 'Plašs materiālu klāsts',
    body: 'Granīts, dolomīts, smiltis, grants, augsne, betona situmi, betons un vairāk. Katram materiālam frakcionālās specifikācijas.',
  },
  {
    icon: Clock,
    title: 'Pieejamības kalkulators',
    body: 'Norādi daudzumu un piegādes datumu — katalogs uzreiz parāda, kurš var izpildīt pasūtījumu. Nav jāgaida atbilde.',
  },
];

const materials = [
  {
    name: 'Granīta šķembas 20–40',
    cat: 'Akmeņi',
    price: '€9.50/t',
    supplier: 'Liepa SIA',
    dist: '12 km',
    avail: 'Šodien',
  },
  {
    name: 'Smilts 0–4',
    cat: 'Smilts',
    price: '€7.20/t',
    supplier: 'Granīts SIA',
    dist: '8 km',
    avail: 'Šodien',
  },
  {
    name: 'Dolomīta grants 0–32',
    cat: 'Grants',
    price: '€6.80/t',
    supplier: 'Akmenssala',
    dist: '24 km',
    avail: 'Rītdien',
  },
  {
    name: 'Melnā augsne',
    cat: 'Augsne',
    price: '€4.20/t',
    supplier: 'Zaļumi SIA',
    dist: '18 km',
    avail: 'Šodien',
  },
];

export default function KatalogsPage() {
  return (
    <>
      <main className="bg-background w-full overflow-clip">
        {/* Back */}
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        {/* HERO */}
        <Hero
          eyebrow="Materiālu Katalogs"
          title={
            <>
              Pasūti materiālus
              <br />
              ar cenu uzreiz.
              <br />
              Bez zvaniem.
            </>
          }
          subtitle="Reālās cenas tieši no piegādātājiem, pieejamības kalkulators. No izvēles līdz pasūtīšanai — ātri."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Atvērt katalogu
            </CTAButton>
          }
        >
          {/* Catalog mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            {/* Search bar */}
            <div className="px-5 py-3.5 border-b border-border">
              <div className="h-9 w-full bg-muted/30 border border-border flex items-center px-3 gap-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">Meklēt materiālu…</span>
              </div>
            </div>
            {/* Filter chips */}
            <div className="flex gap-2 px-5 py-3 border-b border-border overflow-x-auto">
              {['Visi', 'Granīts', 'Smilts', 'Grants', 'Augsne'].map((f, i) => (
                <span
                  key={f}
                  className={`text-xs font-bold tracking-wide uppercase px-3 py-1.5 shrink-0 ${
                    i === 0
                      ? 'bg-foreground text-background'
                      : 'border border-border text-muted-foreground'
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
            {/* Results */}
            <div className="flex flex-col divide-y divide-border">
              {materials.map(({ name, cat, price, supplier, dist, avail }) => (
                <div key={name} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-bold text-xs leading-tight truncate">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {supplier} · {dist} · {cat}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-bold text-xs">{price}</p>
                    <p
                      className={`text-xs mt-0.5 ${avail === 'Šodien' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                    >
                      {avail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Order CTA */}
            <div className="px-5 py-4 border-t border-border">
              <div className="h-10 bg-foreground flex items-center justify-center gap-2">
                <span className="text-xs font-bold tracking-wide uppercase text-background">
                  Pasūtīt — norādīt daudzumu
                </span>
              </div>
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <Container as="section" className="py-24 border-t border-border">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc katalogs maina spēles noteikumus
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border divide-y md:divide-y-0 md:divide-x divide-border">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-8 flex flex-col gap-4">
                <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* Stats row */}
        <section className="w-full border-t border-b border-border bg-muted/20">
          <Container className="py-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
              {[
                { value: 'Reāllaikā', label: 'Cenas tieši no piegādātājiem' },
                { value: 'Dažādi', label: 'Materiālu veidi un frakcijas' },
                { value: 'Digitāli', label: 'Pasūtīšana no izvēles līdz apstiprinājumam' },
              ].map(({ value, label }) => (
                <div key={label} className="md:px-12 first:pl-0 last:pr-0 py-8 md:py-0">
                  <p className="text-6xl font-bold tracking-tighter leading-none">{value}</p>
                  <p className="text-muted-foreground font-light mt-3">{label}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Atrod labāko cenu
              <br />
              zem 3 minūtēm.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Reģistrēties bez maksas
              </CTAButton>
              <p className="text-center text-background/40 text-sm">Nav nepieciešama kredītkarte</p>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
