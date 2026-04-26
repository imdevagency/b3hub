import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { Check, ArrowLeft, Receipt, Banknote, LayoutGrid, Download } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: Receipt,
    title: 'Viens konsolidēts rēķins',
    body: 'Neatkarīgi no tā, cik daudz piegādātāju izmantoji mēnesī — saņem vienu rēķinu. Strukturēts pa projektiem, piegādēm un materiāliem.',
  },
  {
    icon: Banknote,
    title: 'Šoferu izmaksa nākamajā dienā',
    body: 'Šoferis apstiprina piegādi — platforma automātiski aprēķina viņa maksājumu. Izmaksa nākamajā darba dienā bez manuālas darbības.',
  },
  {
    icon: LayoutGrid,
    title: 'ERP & grāmatvedības eksports',
    body: 'Eksportē rēķinus un pasūtījumus CSV formātā integrācijai ar jebkuru grāmatvedības risinājumu.',
  },
  {
    icon: Download,
    title: 'Pilns finanšu arhīvs',
    body: 'Visi rēķini, maksājumi un kvītis pieejami digitālajā arhīvā. Audita vajadzībām — viss dokumentēts un pieejams uzreiz.',
  },
];

export default function MaksajumiPage() {
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
          eyebrow="Rēķini & Maksājumi"
          title={
            <>
              Viens rēķins.
              <br />
              Automātiska
              <br />
              izmaksa.
            </>
          }
          subtitle="Visi piegādātāji, viens strukturēts rēķins mēnesī. Šoferi saņem izmaksu nākamajā dienā. Nav manuālo tabulu, nav kavētu maksājumu."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt bez maksas
            </CTAButton>
          }
        >
          {/* Invoice mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-bold">Rēķins RK-2026-084</p>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">Marts 2026</p>
              </div>
              <span className="text-xs font-bold tracking-wide uppercase border border-foreground/30 px-2.5 py-1">
                Samaksāt līdz 15. Apr
              </span>
            </div>
            {/* Line items */}
            <div className="flex flex-col divide-y divide-border">
              {[
                { desc: 'Granīts karjers — 4 piegādes', sub: 'Liepa SIA · 88 t', amount: '€1 240' },
                { desc: 'Smilts & Grants — 2 piegādes', sub: 'Granīts SIA · 42 t', amount: '€620' },
                { desc: 'Dolomīts — 1 piegāde', sub: 'Akmenssala · 22 t', amount: '€310' },
                { desc: 'Transporta komisija (8%)', sub: 'B3Hub platforma', amount: '€148' },
              ].map(({ desc, sub, amount }) => (
                <div key={desc} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-xs leading-snug">{desc}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                  <span className="font-bold text-xs shrink-0 ml-4">{amount}</span>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="px-6 py-5 border-t-2 border-foreground bg-muted/10 flex items-center justify-between">
              <span className="font-bold tracking-tight">Kopā ar PVN (21%)</span>
              <span className="text-2xl font-bold tracking-tighter">€2 684</span>
            </div>
            {/* Actions */}
            <div className="flex divide-x divide-border border-t border-border">
              {['Lejupielādēt PDF', 'Sūtīt uz ERP'].map((label) => (
                <button
                  key={label}
                  className="flex-1 py-3.5 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Finanses bez galvassāpēm
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
        </section>

        {/* Driver payout section */}
        <section className="w-full bg-background">
          <Container className="py-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-border">
              {[
                { value: '1', unit: 'darba diena', label: 'Šoferu izmaksa pēc piegādes' },
                { value: '8%', unit: '', label: 'Komisija transporta pusei — bez ikmēneša maksas' },
                { value: '0', unit: ' manuālas darbības', label: 'Maksājumu apstrādē' },
              ].map(({ value, unit, label }) => (
                <div key={label} className="md:px-12 first:pl-0 last:pr-0 py-8 md:py-0">
                  <p className="text-5xl font-bold tracking-tighter leading-none">
                    {value}
                    {unit && <span className="text-2xl font-medium ml-1">{unit}</span>}
                  </p>
                  <p className="text-muted-foreground font-light mt-3 text-sm">{label}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Aizmirsti par
              <br />
              manuālajiem rēķiniem.
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
