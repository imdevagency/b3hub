import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Truck, Smartphone, Route, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const benefits = [
 {
 icon: Smartphone,
 title: 'Darbi tieši telefonā',
 body: 'Šoferis saņem piedāvājumu lietotnē ar kravas datiem, iekraušanas vietu, galamērķi un samaksu. Pieņem vai atgriez ar vienu pieskārienu.',
 },
 {
 icon: Route,
 title: 'Maršruts un norādījumi lietotnē',
 body: 'Pēc darba pieņemšanas lietotne parāda maršrutu uz iekraušanas punktu un var atvērt navigāciju ar vienu pieskārienu. Visi norādījumi vienā ekrānā.',
 },
 {
 icon: Truck,
 title: 'Digitālie pavadraksti lietotnē',
 body: 'Šoferis apstiprina iekraušanu, sver kravas svaru un pabeidz piegādi digitāli — papīra pavadrakstu vairs nav vajadzīgi.',
 },
 {
 icon: TrendingUp,
 title: 'Izpeļņas pārskats reāllaikā',
 body: 'Pilns pārskats par visiem paveiktajiem reisiem, izpeļņu un izmaksām. Motivē šoferus pieņemt vairāk darbu.',
 },
];

export default function DispetsPage() {
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
 eyebrow="Šoferu Dispečerizācija"
 title={
 <>
 Darbi šoferiem —
 <br />
 bez zvaniem
 <br />
 dispečeram.
 </>
 }
 subtitle="Platforma automātiski savieno brīvos šofierus ar piegādēm. Šoferis pieņem darbu lietotnē, saņem maršrutu un visu dokumentāciju digitāli."
 actions={
 <>
 <CTAButton href={`/register?role=driver`} variant="primary" size="lg">
 Kļūt par šoferi
 </CTAButton>
 <CTAButton href={`/register`} variant="secondary" size="lg">
 Reģistrēties kā uzņēmums
 </CTAButton>
 </>
 }
 >
 {/* Driver job card mock */}
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-5 bg-foreground text-background">
 <span className="font-bold text-sm">Jauns darbs pieejams</span>
 <span className="font-mono text-xs opacity-60">B3-2854</span>
 </div>

 {/* Job details */}
 <div className="flex flex-col gap-5 p-6">
 <div>
 <p className="text-xs text-muted-foreground mb-1">Materiāls</p>
 <p className="font-bold text-lg tracking-tight">Granīta šķembas 20–40</p>
 <p className="text-muted-foreground text-sm mt-0.5">22 tonnas</p>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="bg-neutral-50 rounded-2xl p-3">
 <p className="text-xs text-muted-foreground mb-1">Iekraušana</p>
 <p className="font-medium text-xs leading-snug">Karjers &quot;Liepa&quot;</p>
 <p className="text-xs text-muted-foreground mt-0.5">Ogre, Meža iela 5</p>
 </div>
 <div className="bg-neutral-50 rounded-2xl p-3">
 <p className="text-xs text-muted-foreground mb-1">Piegāde</p>
 <p className="font-medium text-xs leading-snug">SIA Latvijas Būve</p>
 <p className="text-xs text-muted-foreground mt-0.5">Rīga, A. Kalniņa 12</p>
 </div>
 </div>

 <div className="flex gap-6 text-xs">
 <div>
 <p className="text-muted-foreground mb-0.5">Maršruts</p>
 <p className="font-bold">38 km · ~48 min</p>
 </div>
 <div>
 <p className="text-muted-foreground mb-0.5">Samaksa</p>
 <p className="font-bold text-foreground">€87.00</p>
 </div>
 <div>
 <p className="text-muted-foreground mb-0.5">Izpilde</p>
 <p className="font-bold">Šodien, 14:00–17:00</p>
 </div>
 </div>
 </div>

 {/* Accept/Reject */}
 <div className="grid grid-cols-2 gap-0 ">
 <button className="py-4 text-sm font-bold tracking-wide uppercase text-muted-foreground hover:bg-muted/20 transition-colors">
 Atteikt
 </button>
 <button className="py-4 text-sm font-bold tracking-wide uppercase bg-foreground text-background">
 Pieņemt darbu
 </button>
 </div>
 </div>
 </Hero>

 {/* BENEFITS */}
 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Kāpēc šoferi izvēlas B3Hub
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

 {/* Flow */}
 <section className="w-full bg-background">
 <Container className="py-32">
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Šoferu maršruts platformā
 </p>
 <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
 {[
 {
 step: '01',
 title: 'Saņem push',
 body: 'Jauns darbs pieejams — ar datiem par kravas, maršrutu un samaksu.',
 },
 {
 step: '02',
 title: 'Pieņem darbu',
 body: 'Viena poga lietotnē. Platforma reservē piegādi uz šoferi.',
 },
 {
 step: '03',
 title: 'Brauc uz karjeru',
 body: 'Maršruts redzams lietotnē. Karjers saņem paziņojumu par ierašanos.',
 },
 {
 step: '04',
 title: 'Iekraujas & piegādā',
 body: 'Svars reģistrēts, dokuments sagatavots. Piegāde apstiprināta.',
 },
 {
 step: '05',
 title: 'Saņem izmaksu',
 body: 'Samaksa rēķinā — nākamajā darba dienā automātiski.',
 },
 ].map(({ step, title, body }) => (
 <div
 key={step}
 className="bg-neutral-50 rounded-[2rem] p-8 md:p-10 flex flex-col gap-4 shadow-sm"
 >
 <span className="text-5xl font-black tracking-tighter text-foreground/10 mb-2">{step}</span>
 <h3 className="text-base font-bold tracking-tight">{title}</h3>
 <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
 </div>
 ))}
 </div>
 </Container>
 </section>

 {/* Stats */}
 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 { value: '1 klikšķis', label: 'Lai pieņemtu vai atteiktu piegādes darbu' },
 { value: '1 darba diena', label: 'Izmaksa pēc piegādes apstiprināšanas' },
 { value: '0', label: 'Dispečeru vai starppersonu nepieciešamība' },
 ].map(({ value, label }) => (
 <div key={label} className="bg-background rounded-[2rem] p-10 shadow-sm flex flex-col items-center justify-center">
 <p className="text-5xl font-bold tracking-tighter leading-none">{value}</p>
 <p className="text-muted-foreground font-light mt-3 text-sm">{label}</p>
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
 
 Sāc braukt
 <br />
 ar B3Hub šodien.
 
 </h2>
 <div className="flex flex-col gap-6 min-w-fit shrink-0">
 <CTAButton href={`/register?role=driver`} variant="inverted" size="lg" className="w-full text-center justify-center">
 Reģistrēties kā šoferis
 </CTAButton>
 <p className="text-center text-background/50 text-sm font-medium tracking-wide uppercase">
 Bezmaksas, bez ikmēneša maksas
 </p>
 </div>
 </div>
 </Container>
 </section>
 </main>
 </>
 );
}
