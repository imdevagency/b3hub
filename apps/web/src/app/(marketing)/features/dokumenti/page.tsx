import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { Check, ArrowLeft, FileText, Scale, Receipt, Archive } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: Scale,
 title: 'Digitālā svara zīme',
 body: 'Svara dati no svērtuvēm tieši platformā. Svara zīme tiek ģenerēta automātiski brīdī, kad šoferis apstiprina piegādi.',
 },
 {
 icon: FileText,
 title: 'CMR pavadzīme',
 body: 'Atbilstošs starptautiskajam CMR standartam. Tiek pievienota katrai starptautiskajai un iekšzemes kravai automātiski — bez manuālas aizpildīšanas.',
 },
 {
 icon: Receipt,
 title: 'Automātiskais rēķins',
 body: 'Rēķins iziet pie pircēja tajā pašā dienā, kad piegāde apstiprināta. Strukturēts formāts ar pasūtījuma numuru, daudzumu un cenu.',
 },
 {
 icon: Archive,
 title: '5 gadu arhīvs',
 body: 'Visi dokumenti glabājas drošā mākoņglabātavā 5 gadus. Jebkurā brīdī pieejami lejupielādei PDF vai e-pasta nosūtīšanai.',
 },
];

const docTypes = [
 { code: 'SVZ', name: 'Svara zīme', standard: 'LVS EN', color: 'bg-muted/30' },
 { code: 'CMR', name: 'CMR pavadzīme', standard: 'CMR Convention', color: 'bg-muted/30' },
 { code: 'RK', name: 'Rēķins', standard: 'PVN likums', color: 'bg-foreground text-background' },
 { code: 'PA', name: 'Piegādes akts', standard: 'B3Hub std.', color: 'bg-muted/30' },
];

export default function DokumentiPage() {
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
 eyebrow="Automātiskie dokumenti"
 title={
 <>
 0 pazaudētu
 <br />
 svara zīmju.
 <br />
 Garantēti.
 </>
 }
 subtitle="Svara zīme, CMR un rēķins ģenerējas automātiski brīdī, kad piegāde apstiprināta. Juridiskā spēkā, pieejami 5 gadus."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Izmēģināt bez maksas
 </CTAButton>
 }
 >
 {/* Document stack mock */}
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 ">
 <span className="font-mono text-xs text-muted-foreground tracking-widest">
 B3-2847
 </span>
 <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
 <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Piegādāts 15:18
 </span>
 </div>
 <div className="flex flex-col gap-2">
 {docTypes.map(({ code, name, standard, color }) => (
 <div key={code} className={`flex items-center justify-between px-6 py-4 ${color}`}>
 <div>
 <p className="font-bold text-sm">{name}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{standard}</p>
 </div>
 <div className="flex items-center gap-3">
 <span className="font-mono text-xs opacity-60">
 {code}-4820
 </span>
 <Check className="w-4 h-4" strokeWidth={2.5} />
 </div>
 </div>
 ))}
 </div>
 <div className="flex gap-2 ">
 {['Lejupielādēt PDF', 'Sūtīt e-pastā'].map((label) => (
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

 {/* ── BENEFITS ── */}
 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Katrs dokuments automātiski
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {benefits.map(({ icon: Icon, title, body }) => (
 <div key={title} className="p-10 flex flex-col gap-5 bg-background rounded-[2rem] shadow-sm">
 <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-2 shadow-sm">
 <Icon className="w-6 h-6 text-foreground" strokeWidth={2} />
 </div>
 <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
 <p className="text-muted-foreground text-lg font-light leading-relaxed">{body}</p>
 </div>
 ))}
 </div>
 </Container>
 </section>

 {/* ── WORKFLOW ── */}
 <section className="w-full bg-background">
 <Container className="py-32">
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Automātiskais dokuments — kā tas notiek
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Piegāde apstiprināta',
 body: 'Šoferis plkst. 15:18 apstiprina piegādi lietotnē.',
 },
 {
 step: '02',
 title: 'Svara dati saņemti',
 body: 'Svērtuve pārsūta neto un bruto svaru automātiski.',
 },
 {
 step: '03',
 title: 'Dokumenti ģenerēti',
 body: 'SVZ, CMR un rēķins tiek sagatavoti < 10 sekundēs.',
 },
 {
 step: '04',
 title: 'Nosūtīts & arhivēts',
 body: 'Rēķins pie klienta e-pastā. Viss saglabāts arhīvā 5 gadus.',
 },
 ].map(({ step, title, body }) => (
 <div
 key={step}
 className="bg-neutral-50 rounded-[2rem] p-8 md:p-10 flex flex-col gap-4 shadow-sm"
 >
 <span className="text-5xl font-black tracking-tighter text-foreground/10 mb-2">{step}</span>
 <h3 className="text-lg font-bold tracking-tight">{title}</h3>
 <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
 </div>
 ))}
 </div>
 </Container>
 </section>

 {/* CTA */}
 <section className="w-full bg-background pb-32">
 <Container>
 <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-12 bg-foreground rounded-[4rem] p-12 md:p-20 shadow-2xl">
 <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-background leading-none max-w-2xl">
 
 Aizmirsti par
 <br />
 papīra svara zīmēm.
 
 </h2>
 <div className="flex flex-col gap-6 min-w-fit shrink-0">
 <CTAButton href={`/register`} variant="inverted" size="lg" className="w-full text-center justify-center">
 Reģistrēties bez maksas
 </CTAButton>
 <p className="text-center text-background/50 text-sm font-medium tracking-wide uppercase">Nav nepieciešama kredītkarte</p>
 </div>
 </div>
 </Container>
 </section>
 </main>
 </>
 );
}
