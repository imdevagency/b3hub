import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Contact, Phone, Building2, Star } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: Building2,
 title: 'Piegādātāju profili ar datiem',
 body: 'Katrs piegādātājs platformā ir ar uzņēmuma nosaukumu, reģistrācijas numuru, adresi un kontaktpersonu. Nav anonīmu pārdevēju.',
 },
 {
 icon: Phone,
 title: 'Tiešā saziņa caur platformu',
 body: 'Vajadzīgais kontakts vienmēr sasniedzams no pasūtījuma kopskata. Nav jāmeklē e-pasti vai jāatceras tālruņu numuri.',
 },
 {
 icon: Contact,
 title: 'Vienota kontaktpersonu bāze',
 body: 'Projektu vadītāji, karjeru vadītāji, šoferi — visi pieejami no vienas vietas. Saziņas vēsture saglabāta pie katra pasūtījuma.',
 },
 {
 icon: Star,
 title: 'Piegādātāju vērtējumi',
 body: 'Pēc katras piegādes vari atstāt vērtējumu. Citi pircēji redz, cik uzticams ir konkrētais piegādātājs pirms pasūtīšanas.',
 },
];

export default function KontaktiPage() {
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
 eyebrow="Kontaktu Pārvaldība"
 title={
 <>
 Visi kontakti —
 <br />
 vienā vietā.
 </>
 }
 subtitle="Visi piegādātāji, pārvadātāji un projektu kontakti pieejami tieši no platformas. Nav jāmeklē lietotnes, e-pasti vai telefona grāmatas."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Sākt izmantot
 </CTAButton>
 }
 >
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="px-6 py-4 ">
 <span className="font-bold">Piegādātāju katalogs</span>
 </div>
 {[
 {
 name: 'Karjers "Liepa" SIA',
 type: 'Grants, smiltis',
 rating: '4.9',
 orders: '142',
 },
 { name: 'Granīts SIA', type: 'Granīta šķembas', rating: '4.7', orders: '89' },
 {
 name: 'Smilšu karjers "Ādaži"',
 type: 'Smiltis, mālsmiltis',
 rating: '4.8',
 orders: '203',
 },
 ].map(({ name, type, rating, orders }) => (
 <div
 key={name}
 className="flex items-center justify-between px-6 py-5 last:border-b-0"
 >
 <div>
 <p className="font-bold text-xs">{name}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{type}</p>
 </div>
 <div className="text-right">
 <p className="font-bold text-xs">★ {rating}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{orders} piegādes</p>
 </div>
 </div>
 ))}
 <div className="px-6 py-4 ">
 <div className="h-9 bg-foreground flex items-center justify-center">
 <span className="text-xs font-bold tracking-wide uppercase text-background">
 Skatīt visus piegādātājus
 </span>
 </div>
 </div>
 </div>
 </Hero>

 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Kāpēc svarīgi zināt, ar ko strādā
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
 No kataloga līdz pasūtījumam
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Meklē piegādātāju',
 body: 'Filtrē pēc materiāla veida, atrašanās vietas vai vērtējuma.',
 },
 {
 step: '02',
 title: 'Skati profilu',
 body: 'Uzņēmuma dati, pieejamie materiāli, kontaktpersona un vērtējumu vēsture.',
 },
 {
 step: '03',
 title: 'Pasūti vai vaicā',
 body: 'Pasūti tieši no profila vai sūti cenu pieprasījumu.',
 },
 {
 step: '04',
 title: 'Saziņa platformā',
 body: 'Visi jautājumi un atbildes saglabājas pie pasūtījuma — nav ārējo e-pastu.',
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
 
 Dari darījumus
 <br />
 ar uzticamiem.
 
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
