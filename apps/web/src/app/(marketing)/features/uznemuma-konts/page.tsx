import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Building2, FolderKanban, Users, CreditCard } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: FolderKanban,
 title: 'Visi projekti vienā kontā',
 body: 'Nav atsevišķu kontu dažādiem projektiem. Viens uzņēmuma konts satur visas būvvietas, pasūtījumus un dokumentus strukturēti.',
 },
 {
 icon: Users,
 title: 'Komanda piekļūst visam',
 body: 'Projektu vadītāji, grāmatveži un vadītāji redz savus projektu datus ar atbilstošajām atļaujām — vienā pieteikšanās reizē.',
 },
 {
 icon: Building2,
 title: 'Vairāki piegādātāji — viens konts',
 body: 'Pasūti no desmitiem piegādātāju. Visi pasūtījumi, dokumenti un rēķini centralizēti pie viena uzņēmuma profila.',
 },
 {
 icon: CreditCard,
 title: 'Viens rēķins par visu',
 body: 'Neatkarīgi no tā, cik piegādātāji vai projekti — mēneša beigās saņem vienu konsolidētu rēķinu ar visu sadalījumu.',
 },
];

export default function ViensBiznesKontsPage() {
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
 eyebrow="Uzņēmuma Konts"
 title={
 <>
 Visi projekti.
 <br />
 Visi cilvēki.
 <br />
 Viens konts.
 </>
 }
 subtitle="Nav vairāku kontu, nav e-pastu kopīgošanas. Viens uzņēmuma profils satur visas būvvietas, komandas locekļus, piegādātājus un dokumentus."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Reģistrēt uzņēmumu
 </CTAButton>
 }
 >
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="px-6 py-4 flex justify-between items-center">
 <span className="font-bold">SIA Latvijas Būve</span>
 <span className="text-xs font-bold tracking-widest uppercase bg-neutral-50 rounded-2xl px-2 py-1">
 CONSTRUCTION
 </span>
 </div>
 <div className="grid grid-cols-3 gap-2 ">
 {[
 { value: '6', label: 'Aktīvi projekti' },
 { value: '14', label: 'Komandas locekļi' },
 { value: '38', label: 'Pasūtījumi mēnesī' },
 ].map(({ value, label }) => (
 <div key={label} className="flex flex-col items-center py-5 gap-1">
 <span className="text-2xl font-bold tracking-tighter">{value}</span>
 <span className="text-xs text-muted-foreground text-center">{label}</span>
 </div>
 ))}
 </div>
 <div className="flex flex-col gap-2">
 {[
 { project: 'Rīga, Bauskas iela', status: 'Aktīvs', orders: '12 pasūtījumi' },
 {
 project: 'Jūrmala, Dzintaru prospekts',
 status: 'Aktīvs',
 orders: '8 pasūtījumi',
 },
 { project: 'Ogre, Centrālā iela', status: 'Plānots', orders: '2 pasūtījumi' },
 ].map(({ project, status, orders }) => (
 <div key={project} className="flex items-center justify-between px-6 py-4">
 <div>
 <p className="font-medium text-xs">{project}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{orders}</p>
 </div>
 <span
 className={`text-xs font-bold ${status === 'Aktīvs' ? 'text-foreground' : 'text-muted-foreground'}`}
 >
 {status}
 </span>
 </div>
 ))}
 </div>
 </div>
 </Hero>

 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Kāpēc viss vienā kontā
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
 Sākt strādāt ar uzņēmumu
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Reģistrē uzņēmumu',
 body: 'Ievadi uzņēmuma nosaukumu, reģistrācijas numuru un galveno kontaktu.',
 },
 {
 step: '02',
 title: 'Pievieno projektus',
 body: 'Izveido katru aktīvo būvvieti kā atsevišķu projektu ar adresi un budžetu.',
 },
 {
 step: '03',
 title: 'Uzaicini komandu',
 body: 'Nosūti uzaicinājumus vadītājiem, grāmatvežiem un šoferiem.',
 },
 {
 step: '04',
 title: 'Pasūti un pārraudi',
 body: 'Visi pasūtījumi, dokumenti un rēķini redzami no viena konta.',
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
 
 Viens konts
 <br />
 visam uzņēmumam.
 
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
