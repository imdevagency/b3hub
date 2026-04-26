import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Package, DollarSign, MapPin, Clock } from 'lucide-react';
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
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 {/* Search bar */}
 <div className="px-5 py-3.5 ">
 <div className="h-9 w-full bg-muted/30 bg-neutral-50 rounded-2xl flex items-center px-3 gap-2">
 <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
 <span className="text-xs text-muted-foreground">Meklēt materiālu…</span>
 </div>
 </div>
 {/* Filter chips */}
 <div className="flex gap-2 px-5 py-3 overflow-x-auto">
 {['Visi', 'Granīts', 'Smilts', 'Grants', 'Augsne'].map((f, i) => (
 <span
 key={f}
 className={`text-xs font-bold tracking-wide uppercase px-3 py-1.5 shrink-0 ${
 i === 0
 ? 'bg-foreground text-background'
 : ' text-muted-foreground'
 }`}
 >
 {f}
 </span>
 ))}
 </div>
 {/* Results */}
 <div className="flex flex-col gap-2">
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
 <div className="px-5 py-4 ">
 <div className="h-10 bg-foreground flex items-center justify-center gap-2">
 <span className="text-xs font-bold tracking-wide uppercase text-background">
 Pasūtīt — norādīt daudzumu
 </span>
 </div>
 </div>
 </div>
 </Hero>

 {/* BENEFITS */}
 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Kāpēc katalogs maina spēles noteikumus
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

 {/* Stats row */}
 <section className="w-full bg-background">
 <Container className="py-32">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 { value: 'Reāllaikā', label: 'Cenas tieši no piegādātājiem' },
 { value: 'Dažādi', label: 'Materiālu veidi un frakcijas' },
 { value: 'Digitāli', label: 'Pasūtīšana no izvēles līdz apstiprinājumam' },
 ].map(({ value, label }) => (
 <div key={label} className="bg-background rounded-[2rem] p-10 shadow-sm flex flex-col items-center justify-center">
 <p className="text-6xl font-bold tracking-tighter leading-none">{value}</p>
 <p className="text-muted-foreground font-light mt-3">{label}</p>
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
 
 Atrod labāko cenu
 <br />
 zem 3 minūtēm.
 
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
