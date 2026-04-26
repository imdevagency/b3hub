import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, ShieldCheck, MapPin, Camera, FileText } from 'lucide-react';
import Link from 'next/link';


const benefits = [
 {
 icon: MapPin,
 title: 'GPS apstiprina atrašanās vietu',
 body: 'Piegāde galamērķī tiek reģistrēta tikai tad, kad šoferu GPS koordinātas atbilst piegādes adresei. Nav iespējams atzīmēt piegādi no citas vietas.',
 },
 {
 icon: Camera,
 title: 'Foto kā pierādījums',
 body: 'Šoferis iesniedz piegādes fotogrāfiju, apstiprinot, ka krava ir izkrauta. Foto ar laika zīmogu un GPS saglabājas pie pasūtījuma.',
 },
 {
 icon: FileText,
 title: 'Svara dati no karjera',
 body: 'Iekraušanas svars tiek reģistrēts karjerā. Pircējs var salīdzināt pasūtīto un faktiski piegādāto daudzumu tieši platformā.',
 },
 {
 icon: ShieldCheck,
 title: 'Pilna izsekojamība',
 body: 'Katras piegādes pilna vēsture — iekraušanas laiks, nobrauktais maršruts, piegādes laiks un visi dokumenti saglabājas arhīvā.',
 },
];

export default function FiktivaPiegadeNavPage() {
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
 eyebrow="Piegādes Verifikācija"
 title={
 <>
 Krava vai ir
 <br />
 vai nav —
 <br />
 nav trešā varianta.
 </>
 }
 subtitle="GPS, foto un svara dati apstiprina katru piegādi. Fiktīva atzīmēšana vai nepilna krava tiek konstatēta automātiski un reģistrēta pretenziju sistēmā."
 actions={
 <CTAButton href={`/register`} variant="primary" size="lg">
 Sākt izmantot
 </CTAButton>
 }
 >
 <div className="w-full bg-background rounded-[2rem] shadow-xl flex flex-col text-sm self-center overflow-hidden">
 <div className="px-6 py-4 flex justify-between items-center">
 <span className="font-bold">Piegādes verifikācija</span>
 <span className="text-xs font-bold tracking-widest uppercase text-foreground">
 B3-2854
 </span>
 </div>
 <div className="flex flex-col gap-0 gap-2">
 {[
 { label: 'GPS galamērķī', value: '✓ Apstiprināts', ok: true },
 { label: 'Piegādes foto', value: '✓ Iesniegts 14:32', ok: true },
 { label: 'Svars iekraušanā', value: '22.4 t', ok: true },
 { label: 'Pasūtītais svars', value: '22.0 t', ok: true },
 ].map(({ label, value, ok }) => (
 <div key={label} className="flex items-center justify-between px-6 py-4">
 <span className="text-xs text-muted-foreground">{label}</span>
 <span className={`text-xs font-bold ${ok ? 'text-foreground' : 'text-red-500'}`}>
 {value}
 </span>
 </div>
 ))}
 </div>
 <div className="px-6 py-4 bg-foreground">
 <p className="text-xs font-bold text-background text-center tracking-wide uppercase">
 Piegāde apstiprināta — visi kritēriji izpildīti
 </p>
 </div>
 </div>
 </Hero>

 <section className="w-full bg-neutral-50 pb-32 pt-16">
 <Container>
 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
 Kā platforma aizsargā pircēju
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
 Piegādes apstiprināšanas process
 </p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 {
 step: '01',
 title: 'Šoferis ierodas',
 body: 'GPS reģistrē ierašanos galamērķī. Pircējs saņem paziņojumu.',
 },
 {
 step: '02',
 title: 'Izkrauj kravas',
 body: 'Šoferis fotografē izkrautas kravas un augšupielādē lietotnē.',
 },
 {
 step: '03',
 title: 'Sistēma pārbauda',
 body: 'GPS, foto un svara dati automātiski salīdzināti ar pasūtījumu.',
 },
 {
 step: '04',
 title: 'Piegāde apstiprināta',
 body: 'Dokumenti ģenerējas, pircējs tiek informēts, rēķins sagatavots.',
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
 
 Maksā tikai
 <br />
 par piegādāto.
 
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
