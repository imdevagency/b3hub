import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, LayoutList, Filter, Bell, BarChart2 } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: LayoutList,
 title: 'Visi pasūtījumi vienā sarakstā',
 body: 'Visi aktīvie un vēsturiskie pasūtījumi no visiem projektiem un piegādātājiem — vienā strukturētā skatā ar meklēšanu un filtriem.',
 },
 {
 icon: Filter,
 title: 'Filtrēšana pēc statusa un projekta',
 body: 'Filtrē pēc statusa (gaidoši, aktīvi, pabeigti), projekta, piegādātāja vai datuma. Atrod jebkuru pasūtījumu sekundēs.',
 },
 {
 icon: Bell,
 title: 'Reāllaika statusa atjauninājumi',
 body: 'Pasūtījuma statuss mainās reāllaikā — no apstiprināšanas līdz piegādei. Skatāms no datora un mobilā telefona.',
 },
 {
 icon: BarChart2,
 title: 'Apjoma un izmaksu statistika',
 body: 'Redzi kopējo pasūtīto daudzumu, izmaksas pa mēnešiem un aktīvo pasūtījumu skaitu. Viss pārskatāmi bez Exceļa.',
 },
];

export default function PasutijumuParskatPage() {
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
 eyebrow="Pasūtījumu Pārskats"
 title={
 <>
 Visi pasūtījumi —
 <br />
 vienā skatā.
 </>
 }
 subtitle="Aktīvie braucieni, gaidošie apstiprinājumi un piegādātā vēsture — vienā sarakstā ar filtriem un reāllaika statusiem."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Sākt izmantot
 </CTAButton>
 }
 >
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 ">
 <span className="font-bold">Pasūtījumi</span>
 <span className="text-xs text-muted-foreground">Aprīlis 2026</span>
 </div>
 <div className="flex gap-2 px-6 py-3 overflow-x-auto">
 {['Visi (38)', 'Aktīvi (6)', 'Gaidoši (3)', 'Pabeigti (29)'].map((tab, i) => (
 <span
 key={tab}
 className={`text-xs font-bold whitespace-nowrap px-3 py-1.5 shrink-0 ${i === 0 ? 'border-foreground bg-foreground text-background' : ' text-muted-foreground'}`}
 >
 {tab}
 </span>
 ))}
 </div>
 {[
 {
 id: 'B3-2854',
 material: 'Granīta šķembas 20/40',
 status: 'Piegādāts',
 date: '14.04.',
 },
 { id: 'B3-2853', material: 'Smiltis 0–4 mm', status: 'Braucienā', date: '14.04.' },
 { id: 'B3-2851', material: 'Grants 8–16 mm', status: 'Gaida apst.', date: '13.04.' },
 ].map(({ id, material, status, date }) => (
 <div
 key={id}
 className="flex items-center justify-between px-6 py-4 last:border-b-0"
 >
 <div>
 <p className="font-bold text-xs">{material}</p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {id} · {date}
 </p>
 </div>
 <span
 className={`text-xs font-bold tracking-wide ${status === 'Piegādāts' ? 'text-muted-foreground' : 'text-foreground'}`}
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
 Ko dod pilns pārskats
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
 No pasūtīšanas līdz arhīvam
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Izveido pasūtījumu',
 body: 'Izvēlies materiālu, daudzumu un piegādes datumu no kataloga.',
 },
 {
 step: '02',
 title: 'Piegādātājs apstiprina',
 body: 'Pasūtījums pāriet "Apstiprināts" statusā — redzams sarakstā reāllaikā.',
 },
 {
 step: '03',
 title: 'Seko piegādei',
 body: 'Brauciena laikā statuss mainās uz "Braucienā" — ar GPS kartes skatījumu.',
 },
 {
 step: '04',
 title: 'Arhīvā automātiski',
 body: 'Pēc piegādes pasūtījums nokrīt "Pabeigts" ar visiem dokumentiem.',
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
 
 Kontrolē visu
 <br />
 no vienas vietas.
 
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
