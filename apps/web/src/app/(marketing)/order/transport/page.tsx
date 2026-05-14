import Link from 'next/link';
import { Truck, Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  'Vienreizēji un regulāri maršruti visā Latvijā',
  'Tipper, flatbed, kravas furgons — jūs izvēlaties',
  'ON-DEMAND izsūtīšana vai plānota piegāde',
  'Piegādes uzraudzība reāllaikā',
  'Automātiska dokumentācija un rēķini',
];

export default function TransportLandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f5f4] flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-lg">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-[#1a362a] flex items-center justify-center">
            <Truck className="w-9 h-9 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-center text-foreground tracking-tight mb-4">
          Kravu pārvadājumi
        </h1>
        <p className="text-center text-muted-foreground leading-relaxed mb-10">
          Uzticama kravas pārvadāšana uzņēmumiem visā Latvijā. Pasūtiet furgonu, platformu vai
          pašizgāzēju — tieši uz jūsu objektu.
        </p>

        {/* Feature list */}
        <ul className="space-y-3 mb-10">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1a362a] mt-0.5 shrink-0" strokeWidth={2} />
              <span className="text-sm text-foreground">{f}</span>
            </li>
          ))}
        </ul>

        {/* Company requirement notice */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <Building2 className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Šis pakalpojums ir pieejams <strong>tikai reģistrētiem uzņēmumiem</strong>. Piesakieties
            vai izveidojiet kontu ar uzņēmuma informāciju, lai turpinātu.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 h-12 rounded-2xl text-sm font-semibold">
            <Link href="/login?redirect=/dashboard/order/transport">
              Pieslēgties
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold"
          >
            <Link href="/register?redirect=/dashboard/order/transport">Reģistrēties</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
