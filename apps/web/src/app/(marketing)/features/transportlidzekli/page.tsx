import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Car, Wrench, BarChart2, Users } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: Car,
 title: 'Visi transportlīdzekļi vienā sarakstā',
 body: 'Reģistrē katru auto ar tipa datiem — kravas kapacitāti, aksi skaitu un pieejamību. Visi redzami uzņēmuma portālā vienā skatā.',
 },
 {
 icon: Users,
 title: 'Šoferu piešķiršana transportam',
 body: 'Katra auto var piešķirt konkrētam šoferim. Pasūtījumi tiek virzīti uz pareizo kombināciju — šoferis + auto ar atbilstošu kapacitāti.',
 },
 {
 icon: Wrench,
 title: 'Blokēšana uz atpūtas dienām',
 body: 'Iestati brīvdienas vai tehniskās apkopes periodus katram auto. Sistēma nepiešķirs darbus bloķētiem transportlīdzekļiem.',
 },
 {
 icon: BarChart2,
 title: 'Izpildīto darbu statistika pa auto',
 body: 'Redzi, cik daudz katrs auto ir nobraucis, cik kravas piegādājis un kādi ir ienākumi pa transportlīdzekli pa mēnesi.',
 },
];

export default function TransportlīdzekļiPage() {
 return (
 <>
 <main className="bg-background w-full overflow-clip">
 <Container className="pt-28 pb-0">
 <Link
 href="/features"
 className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
 >
 <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
 </Link>
 </Container>

 <Hero
 eyebrow="Transportlīdzekļu Pārvaldība"
 title={
 <>
 Visa flote —
 <br />
 vienā ekrānā.
 </>
 }
 subtitle="Reģistrē savus transportlīdzekļus, piešķir šoferi katram auto un kontrolē kapacitāti. Platforma nodrošina, ka pareizā krava nonāk pareizajā auto."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Pievienot floti
 </CTAButton>
 }
 >
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="px-6 py-4 flex justify-between items-center">
 <span className="font-bold">Flotes pārvaldība</span>
 <span className="text-xs text-muted-foreground">4 transportlīdzekļi</span>
 </div>
 {[
 {
 plate: 'LV·AB-1234',
 type: 'Pašizgāzējs 20t',
 driver: 'Jānis B.',
 status: 'Aktīvs',
 },
 {
 plate: 'LV·CD-5678',
 type: 'Pašizgāzējs 12t',
 driver: 'Pēteris K.',
 status: 'Brīvs',
 },
 { plate: 'LV·EF-9012', type: 'Kravas auto 8t', driver: '—', status: 'Apkope' },
 {
 plate: 'LV·GH-3456',
 type: 'Pašizgāzējs 25t',
 driver: 'Andris L.',
 status: 'Brīvs',
 },
 ].map(({ plate, type, driver, status }) => (
 <div
 key={plate}
 className="flex items-center justify-between px-6 py-4 last:border-b-0"
 >
 <div>
 <p className="font-bold text-xs">{plate}</p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {type} · {driver}
 </p>
 </div>
 <span
 className={`text-xs font-bold tracking-wide uppercase px-2 py-1 ${status === 'Aktīvs' ? 'border-foreground bg-foreground text-background' : status === 'Apkope' ? ' text-muted-foreground' : ''}`}
 >
 {status}
 </span>
 </div>
 ))}
 </div>
 </Hero>

 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Ko dod flotes vadība
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

 <section className="w-full bg-background">
 <Container className="py-32">
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Pievienot transportlīdzekli
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Reģistrē auto',
 body: 'Ievadi numura zīmi, tipu un kravas kapacitāti.',
 },
 {
 step: '02',
 title: 'Piešķir šoferi',
 body: 'Savieno auto ar komandas locekli, kurš to vada.',
 },
 {
 step: '03',
 title: 'Iestata pieejamību',
 body: 'Norādi apkopes periodus vai brīvdienas ar kalendāru.',
 },
 {
 step: '04',
 title: 'Saņem darbus',
 body: 'Platforma automātiski piešķir pasūtījumus brīvajiem auto ar atbilstošu kapacitāti.',
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

 <section className="w-full bg-background pb-32">
 <Container>
 <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-12 bg-foreground rounded-[4rem] p-12 md:p-20 shadow-2xl">
 <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-background leading-none max-w-2xl">
 
 Flote
 <br />
 zem kontroles.
 
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
